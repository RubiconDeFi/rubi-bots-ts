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
    private pollInterval: number;
    private orderLadderSize: number;

    constructor(
        chainID: number,
        walletWithProvider: ethers.Wallet,
        userAddress: string,
        baseAddress: string,
        quoteAddress: string,
        pollInterval: number = 5000,
        orderLadderSize: number = 5
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
        this.pollInterval = pollInterval;
        this.orderLadderSize = orderLadderSize;
    }

    async runStrategy() {
        console.log("Starting AMM Strategy");
        this.rubiconBookTracker.pollForBookUpdates(this.pollInterval / 2);
        await this.updateOrders(); // Initial order placement
        setInterval(async () => {
            try {
                await this.updateOrders();
            } catch (error) {
                console.error("Error executing AMM Strategy:", error);
            }
        }, this.pollInterval);
    }

    private async updateOrders() {
        const currentPrice = await this.calculateCurrentPrice();
        const desiredBook = await this.buildDesiredBook(currentPrice);
        
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

    private async calculateCurrentPrice(): Promise<number> {
        const reserveBase = await this.rubiconConnector.onChainAvailableAssetBalance;
        const reserveQuote = await this.rubiconConnector.onChainAvailableQuoteBalance;

        if (reserveBase === 0 || reserveQuote === 0) {
            // If either reserve is zero, use a default price or fetch from an oracle
            return 1; // Replace with appropriate default or oracle price
        } else {
            // Use the constant product formula: price = reserveQuote / reserveBase
            return reserveQuote / reserveBase;
        }
    }

    private async buildDesiredBook(currentPrice: number): Promise<{ bids: GenericOrder[], asks: GenericOrder[] }> {
        const bids: GenericOrder[] = [];
        const asks: GenericOrder[] = [];

        const reserveBase = await this.rubiconConnector.onChainAvailableAssetBalance;
        const reserveQuote = await this.rubiconConnector.onChainAvailableQuoteBalance;

        const maxBaseToUse = reserveBase * 0.95;
        const maxQuoteToUse = reserveQuote * 0.95;

        const priceRange = 0.2; // 20% price range for orders
        const baseIncrement = maxBaseToUse / this.orderLadderSize;
        const quoteIncrement = maxQuoteToUse / this.orderLadderSize;

        const minBidSize = MIN_ORDER_SIZES[this.quoteToken.symbol];
        const minAskSize = MIN_ORDER_SIZES[this.baseToken.symbol];

        for (let i = 0; i < this.orderLadderSize; i++) {
            const bidPrice = currentPrice * Math.pow(1 - priceRange, (i + 1) / this.orderLadderSize);
            const askPrice = currentPrice * Math.pow(1 + priceRange, (i + 1) / this.orderLadderSize);

            let bidSize = quoteIncrement / bidPrice;
            let askSize = baseIncrement;

            // Ensure bid size is above minimum
            if (bidSize * bidPrice >= minBidSize) {
                bids.push({ price: bidPrice, size: bidSize });
            } else if (quoteIncrement >= minBidSize) {
                // If individual bid is too small, place one larger bid
                bidSize = minBidSize / bidPrice;
                bids.push({ price: bidPrice, size: bidSize });
                break;
            }

            // Ensure ask size is above minimum
            if (askSize >= minAskSize) {
                asks.push({ price: askPrice, size: askSize });
            } else if (baseIncrement >= minAskSize) {
                // If individual ask is too small, place one larger ask
                askSize = minAskSize;
                asks.push({ price: askPrice, size: askSize });
                break;
            }
        }

        return { bids, asks };
    }

    public async buyTokens(amount: ethers.BigNumber): Promise<void> {
        const price = await this.calculateCurrentPrice();
        const cost = amount.mul(ethers.utils.parseUnits(price.toFixed(this.quoteToken.decimals), this.quoteToken.decimals));
        
        // Implement the actual token purchase logic here
        // This would involve interacting with the smart contract

        console.log(`Bought ${ethers.utils.formatUnits(amount, this.baseToken.decimals)} tokens for ${ethers.utils.formatUnits(cost, this.quoteToken.decimals)} ${this.quoteToken.symbol}`);
    }

    public async sellTokens(amount: ethers.BigNumber): Promise<void> {
        const price = await this.calculateCurrentPrice();
        const revenue = amount.mul(ethers.utils.parseUnits(price.toFixed(this.quoteToken.decimals), this.quoteToken.decimals));
        
        // Implement the actual token selling logic here
        // This would involve interacting with the smart contract

        console.log(`Sold ${ethers.utils.formatUnits(amount, this.baseToken.decimals)} tokens for ${ethers.utils.formatUnits(revenue, this.quoteToken.decimals)} ${this.quoteToken.symbol}`);
    }

    private calculateTradeAmount(
        price: number,
        isBuy: boolean,
        reserveBase: number,
        reserveQuote: number,
        k: number
    ): number {
        if (isBuy) {
            // Calculate amount of base token received for a given amount of quote token
            const quoteIn = 1; // Assume 1 unit of quote token for calculation
            const baseOut = reserveBase - (k / (reserveQuote + quoteIn));
            return baseOut / price; // Convert to quote token amount
        } else {
            // Calculate amount of quote token received for a given amount of base token
            const baseIn = 1; // Assume 1 unit of base token for calculation
            const quoteOut = reserveQuote - (k / (reserveBase + baseIn));
            return quoteOut * price; // Convert to base token amount
        }
    }
}
