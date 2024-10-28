import { ethers } from "ethers";
import { RubiconConnector } from "../../connectors/rubicon";
import { RubiconBookTracker } from "../../referenceVenues/rubicon";
import { MIN_ORDER_SIZES } from "../../config/rubicon";
import { TokenInfo } from "@uniswap/token-lists";
import { GenericOrder, GenericOrderWithData } from "../../types/rubicon";
import { getTokenInfoFromAddress } from "../../utils/rubicon";
import { tokenList } from "../../config/tokens";

export class BondingCurveStrategy {
    private rubiconConnector!: RubiconConnector;
    private rubiconBookTracker!: RubiconBookTracker;
    private baseToken!: TokenInfo;
    private quoteToken!: TokenInfo;
    private pollInterval: number;
    private orderLadderSize: number;
    private chainID: number;
    private userAddress: string;
    private baseAddress: string;
    private quoteAddress: string;
    private provider: ethers.providers.Provider;

    constructor(
        chainID: number,
        walletWithProvider: ethers.Wallet,
        userAddress: string,
        baseAddress: string,
        quoteAddress: string,
        pollInterval: number = 5000,
        orderLadderSize: number = 5
    ) {
        this.chainID = chainID;
        this.userAddress = userAddress;
        this.baseAddress = baseAddress;
        this.quoteAddress = quoteAddress;
        this.pollInterval = pollInterval;
        this.orderLadderSize = orderLadderSize;
        this.provider = walletWithProvider.provider!;

        // Check and fetch token information if necessary
        this.initializeTokens().then(() => {
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
        });
    }

    private async initializeTokens() {
        try {
            this.baseToken = getTokenInfoFromAddress(this.baseAddress, this.chainID);
            this.quoteToken = getTokenInfoFromAddress(this.quoteAddress, this.chainID);
        } catch (error) {
            console.log("Token information not found in the list. Fetching from chain...");
            await this.fetchAndSaveTokenInfo();
        }
    }

    private async fetchAndSaveTokenInfo() {
        const ERC20ABI = [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)"
        ];

        const baseContract = new ethers.Contract(this.baseAddress, ERC20ABI, this.provider);
        const quoteContract = new ethers.Contract(this.quoteAddress, ERC20ABI, this.provider);

        const [baseName, baseSymbol, baseDecimals, quoteName, quoteSymbol, quoteDecimals] = await Promise.all([
            baseContract.name(),
            baseContract.symbol(),
            baseContract.decimals(),
            quoteContract.name(),
            quoteContract.symbol(),
            quoteContract.decimals()
        ]);

        this.baseToken = {
            name: baseName,
            symbol: baseSymbol,
            chainId: this.chainID,
            address: this.baseAddress,
            decimals: baseDecimals
        };

        this.quoteToken = {
            name: quoteName,
            symbol: quoteSymbol,
            chainId: this.chainID,
            address: this.quoteAddress,
            decimals: quoteDecimals
        };

        console.log("adding these tokens dynamically");
        console.log(this.baseToken);
        console.log(this.quoteToken);

        // Add these tokens to the in-memory token list
        tokenList.tokens.push(this.baseToken, this.quoteToken);
    }

    async runStrategy() {
        console.log("Starting Bonding Curve Strategy");
        
        // Wait for token initialization
        while (!this.baseToken || !this.quoteToken || !this.rubiconConnector || !this.rubiconBookTracker) {
            await new Promise(resolve => setTimeout(resolve, 4000));
        }

        this.rubiconBookTracker.pollForBookUpdates(this.pollInterval / 2);
        
        let gate = false;
        let gateHitCount = 0;
        setInterval(async () => {
            try {
                if (gate) {
                    console.log("Gate is up, skipping order update");
                    gateHitCount++;
                    if (gateHitCount >= 5) {
                        console.log("Gate hit 10 times, clearing gate");
                        gate = false;
                        gateHitCount = 0;
                    }
                    return;
                }
                gate = true;
                gateHitCount = 0;

                console.log("Calculating current price");
                const currentPrice = await this.calculateCurrentPrice();
                console.log("Building desired book");
                const desiredBook = await this.buildDesiredBook(currentPrice);
                console.log("Updating Rubicon orders");
                await this.updateRubiconOrders(desiredBook);

                gate = false;
            } catch (error) {
                console.error("Error executing Bonding Curve Strategy:", error);
                gate = false;
                gateHitCount = 0;
            }
        }, this.pollInterval);
    }

    private async calculateCurrentPrice(): Promise<number> {
        const reserveBase = this.rubiconConnector.onChainAvailableAssetBalance;
        const reserveQuote = this.rubiconConnector.onChainAvailableQuoteBalance;

        if (reserveBase === 0 || reserveQuote === 0) {
            return 0.000000001; //very arbitrary price!
        } else {
            return reserveQuote / reserveBase;
        }
    }

    private async buildDesiredBook(currentPrice: number): Promise<{ bids: GenericOrder[], asks: GenericOrder[] }> {
        const bids: GenericOrder[] = [];
        const asks: GenericOrder[] = [];

        const reserveBase = this.rubiconConnector.onChainAvailableAssetBalance;
        const reserveQuote = this.rubiconConnector.onChainAvailableQuoteBalance;

        const maxBaseToUse = reserveBase * 0.95;  // Using 95% of available balance
        const maxQuoteToUse = reserveQuote * 0.95;

        // TODO: These should be configuration variables
        /// @dev Key drivers for curve aggressiveness and positioning, w/ the other being ladder size
        const priceRange = 6; // Increased for more aggressive price scaling
        const sizeRange = 12;  // Size will scale up to 3x the base size

        const baseSize = maxBaseToUse / (this.orderLadderSize * 2); // Smaller base size since we're scaling up
        const quoteSize = maxQuoteToUse / (this.orderLadderSize * 2);

        const minBidSize = MIN_ORDER_SIZES[this.quoteToken.symbol];
        const minAskSize = MIN_ORDER_SIZES[this.baseToken.symbol];

        for (let i = 0; i < this.orderLadderSize; i++) {
            // Exponential scaling for both price and size
            const bidPrice = currentPrice * Math.pow(1 - priceRange, (i + 1) / this.orderLadderSize);
            const askPrice = currentPrice * Math.pow(1 + priceRange, (i + 1) / this.orderLadderSize);

            // Size increases exponentially as price moves further from mid
            const sizeFactor = Math.pow(sizeRange, i / this.orderLadderSize);
            
            let bidSize = (quoteSize * sizeFactor) / bidPrice;
            let askSize = baseSize * sizeFactor;

            if (bidSize * bidPrice >= minBidSize) {
                bids.push({ price: bidPrice, size: bidSize });
            }

            if (askSize >= minAskSize) {
                asks.push({ price: askPrice, size: askSize });
            }
        }

        return { bids, asks };
    }

    private async updateRubiconOrders(desiredBook: { bids: GenericOrder[], asks: GenericOrder[] }) {
        const currentBids = this.rubiconBookTracker.getUserBook().bids;
        const currentAsks = this.rubiconBookTracker.getUserBook().asks;

        const updatePromises: Promise<any>[] = [];

        // Update bids
        this.updateOrderSide(desiredBook.bids, currentBids, true, updatePromises);

        // Update asks
        this.updateOrderSide(desiredBook.asks, currentAsks, false, updatePromises);

        await Promise.all(updatePromises);
    }

    private async updateOrderSide(
        desiredOrders: GenericOrder[],
        currentOrders: GenericOrderWithData[],
        isBid: boolean,
        updatePromises: Promise<any>[]
    ) {
        // Sort desired orders
        desiredOrders.sort((a, b) => isBid ? b.price - a.price : a.price - b.price);

        // Sort current orders
        currentOrders.sort((a, b) => isBid ? b.price - a.price : a.price - b.price);

        const currentTime = Math.floor(Date.now() / 1000);
        const refreshThreshold = currentTime + (2 * this.pollInterval / 1000);

        for (let i = 0; i < Math.max(desiredOrders.length, currentOrders.length); i++) {
            const desiredOrder = desiredOrders[i];
            const currentOrder = currentOrders[i];

            if (desiredOrder && currentOrder) {
                const priceDiff = Math.abs(currentOrder.price - desiredOrder.price) / currentOrder.price;
                const sizeDiff = Math.abs(currentOrder.size - desiredOrder.size) / currentOrder.size;
                const needsRefresh = currentOrder.deadline <= refreshThreshold;

                if (priceDiff > 0.001 || sizeDiff > 0.001 || needsRefresh) {
                    console.log(`Updating ${isBid ? 'bid' : 'ask'} at price: ${desiredOrder.price}, size: ${desiredOrder.size}${needsRefresh ? ' (refreshing)' : ''}`);
                    updatePromises.push(this.rubiconConnector.editOrder(currentOrder.hash, desiredOrder.size, desiredOrder.price, isBid));
                }
            } else if (desiredOrder) {
                console.log(`Placing new ${isBid ? 'bid' : 'ask'} at price: ${desiredOrder.price}, size: ${desiredOrder.size} token ${isBid ? this.quoteToken.symbol : this.baseToken.symbol} `);
                updatePromises.push(this.rubiconConnector.placeOrder(desiredOrder.size, desiredOrder.price, isBid));
            } else if (currentOrder) {
                console.log(`Cancelling ${isBid ? 'bid' : 'ask'} at price: ${currentOrder.price}, size: ${currentOrder.size}`);
                updatePromises.push(this.rubiconConnector.cancelOrder(currentOrder.hash));
            }
        }
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
