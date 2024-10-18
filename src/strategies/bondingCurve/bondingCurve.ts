import { ethers } from "ethers";
import { RubiconConnector } from "../../connectors/rubicon";
import { RubiconBookTracker } from "../../referenceVenues/rubicon";
import { MIN_ORDER_SIZES } from "../../config/rubicon";
import { TokenInfo } from "@uniswap/token-lists";
import { GenericOrder, GenericOrderWithData } from "../../types/rubicon";

export class BondingCurveStrategy {
    private rubiconConnector: RubiconConnector;
    private rubiconBookTracker: RubiconBookTracker;
    private baseToken: TokenInfo;
    private quoteToken: TokenInfo;
    private reserveRatio: number;
    private initialSupply: ethers.BigNumber;
    private initialPrice: number;
    private currentSupply: ethers.BigNumber;
    private pollInterval: number;
    private orderLadderSize: number;
    private spreadFactor: number;

    constructor(
        chainID: number,
        walletWithProvider: ethers.Wallet,
        userAddress: string,
        baseAddress: string,
        quoteAddress: string,
        reserveRatio: number,
        initialSupply: string,
        initialPrice: number,
        pollInterval: number = 5000,
        orderLadderSize: number = 5,
        spreadFactor: number = 0.005
    ) {
        this.rubiconConnector = new RubiconConnector(
            chainID,
            walletWithProvider,
            userAddress,
            baseAddress,
            quoteAddress
        );
        this.rubiconBookTracker = new RubiconBookTracker(
            chainID,
            userAddress,
            baseAddress,
            quoteAddress
        );
        this.baseToken = this.rubiconConnector.base;
        this.quoteToken = this.rubiconConnector.quote;
        this.reserveRatio = reserveRatio;
        this.initialSupply = ethers.utils.parseUnits(initialSupply, this.baseToken.decimals);
        this.initialPrice = initialPrice;
        this.currentSupply = this.initialSupply;
        this.pollInterval = pollInterval;
        this.orderLadderSize = orderLadderSize;
        this.spreadFactor = spreadFactor;
    }

    async runStrategy() {
        console.log("Starting Bonding Curve Strategy");
        this.rubiconBookTracker.pollForBookUpdates(this.pollInterval / 2);
        await this.updateOrders(); // Initial order placement
        setInterval(async () => {
            try {
                await this.updateOrders();
            } catch (error) {
                console.error("Error executing Bonding Curve Strategy:", error);
            }
        }, this.pollInterval);
    }

    private async updateOrders() {
        const currentPrice = this.calculateCurrentPrice();
        const desiredBook = this.buildDesiredBook(currentPrice);
        
        const userBook = this.rubiconBookTracker.getUserBook();

        // Update bids
        await this.updateOrderSide(desiredBook.bids, userBook.bids, true);
        // Update asks
        await this.updateOrderSide(desiredBook.asks, userBook.asks, false);
    }

    private async updateOrderSide(desiredOrders: GenericOrder[], currentOrders: GenericOrderWithData[], isBid: boolean) {
        for (const desiredOrder of desiredOrders) {
            const existingOrder = currentOrders.find(order => 
                Math.abs(order.price - desiredOrder.price) / order.price < 0.01 && 
                Math.abs(order.size - desiredOrder.size) / order.size < 0.01
            );

            if (existingOrder) {
                // Order exists and is close enough, no action needed
                continue;
            }

            // Cancel any orders at this price level
            const ordersToCancel = currentOrders.filter(order => 
                Math.abs(order.price - desiredOrder.price) / order.price < 0.01
            );
            for (const orderToCancel of ordersToCancel) {
                await this.rubiconConnector.cancelOrder(orderToCancel.hash);
            }

            // Place the new order
            await this.placeOrder(desiredOrder, isBid);
        }

        // Cancel any remaining orders that are not in the desired book
        const desiredPrices = desiredOrders.map(order => order.price);
        const ordersToCancel = currentOrders.filter(order => 
            !desiredPrices.some(price => Math.abs(price - order.price) / order.price < 0.01)
        );
        for (const orderToCancel of ordersToCancel) {
            await this.rubiconConnector.cancelOrder(orderToCancel.hash);
        }
    }

    private async placeOrder(order: GenericOrder, isBid: boolean) {
        const minSize = MIN_ORDER_SIZES[isBid ? this.quoteToken.symbol : this.baseToken.symbol];
        const orderSize = isBid ? order.size * order.price : order.size;

        if (orderSize >= minSize) {
            await this.rubiconConnector.placeOrder(order.size, order.price, isBid);
            console.log(`Placed ${isBid ? 'bid' : 'ask'} order: size ${order.size}, price ${order.price}`);
        } else {
            console.log(`${isBid ? 'Bid' : 'Ask'} order size ${orderSize} is below minimum ${minSize}`);
        }
    }

    private calculateCurrentPrice(): number {
        const reserveBalance = this.calculateReserveBalance();
        return reserveBalance / (this.currentSupply.toNumber() * this.reserveRatio);
    }

    private calculateReserveBalance(): number {
        return this.initialPrice * this.initialSupply.toNumber() * this.reserveRatio;
    }

    private buildDesiredBook(currentPrice: number): { bids: GenericOrder[], asks: GenericOrder[] } {
        const bids: GenericOrder[] = [];
        const asks: GenericOrder[] = [];

        const baseBalance = this.rubiconConnector.onChainAvailableAssetBalance;
        const quoteBalance = this.rubiconConnector.onChainAvailableQuoteBalance;

        const baseStep = baseBalance / this.orderLadderSize;
        const quoteStep = quoteBalance / this.orderLadderSize;

        // Exponential factor for ask prices
        const expFactor = Math.pow(1 + this.spreadFactor, this.orderLadderSize);

        for (let i = 0; i < this.orderLadderSize; i++) {
            const bidPrice = currentPrice * (1 - this.spreadFactor * (i + 1));
            // Exponential progression for ask prices
            const askPrice = currentPrice * Math.pow(expFactor, (i + 1) / this.orderLadderSize);

            const bidSize = quoteStep / bidPrice;
            // Decreasing size for higher ask prices
            const askSize = baseStep * (1 - i / this.orderLadderSize);

            bids.push({ price: bidPrice, size: bidSize });
            asks.push({ price: askPrice, size: askSize });
        }

        return { bids, asks };
    }

    public async buyTokens(amount: ethers.BigNumber): Promise<void> {
        const price = this.calculateCurrentPrice();
        const cost = amount.mul(ethers.utils.parseUnits(price.toFixed(this.quoteToken.decimals), this.quoteToken.decimals));
        
        // Implement the actual token purchase logic here
        // This would involve interacting with the smart contract

        this.currentSupply = this.currentSupply.add(amount);
        console.log(`Bought ${ethers.utils.formatUnits(amount, this.baseToken.decimals)} tokens for ${ethers.utils.formatUnits(cost, this.quoteToken.decimals)} ${this.quoteToken.symbol}`);
    }

    public async sellTokens(amount: ethers.BigNumber): Promise<void> {
        const price = this.calculateCurrentPrice();
        const revenue = amount.mul(ethers.utils.parseUnits(price.toFixed(this.quoteToken.decimals), this.quoteToken.decimals));
        
        // Implement the actual token selling logic here
        // This would involve interacting with the smart contract

        this.currentSupply = this.currentSupply.sub(amount);
        console.log(`Sold ${ethers.utils.formatUnits(amount, this.baseToken.decimals)} tokens for ${ethers.utils.formatUnits(revenue, this.quoteToken.decimals)} ${this.quoteToken.symbol}`);
    }
}
