import { ethers } from "ethers";
import { RubiconConnector } from "../../connectors/rubiconGladius";
import { KrakenReferenceVenue } from "../../referenceVenues/kraken";
import { RubiconBookTracker } from "../../referenceVenues/rubicon";
import { MIN_ORDER_SIZES } from "../../config/rubicon";

export class CexMarketMaking {
    chainID: number;
    userAddress: string;
    baseAddress: string;
    quoteAddress: string;
    provider: ethers.providers.Provider;

    referenceCEXBaseTicker: string;
    referenceCEXQuoteTicker: string;

    rubiconConnector: RubiconConnector;
    referenceVenueConnector: KrakenReferenceVenue;
    rubiconBookWatcher: RubiconBookTracker;
    walletWithProvider: ethers.Wallet;

    pollInterval: number;
    orderLadderSize: number; // Number of price levels (e.g., 3 bids and 3 asks)
    priceStepFactor: number;

    constructor(
        chainID: number,
        walletWithProvider: ethers.Wallet,
        // userAddress: string,
        baseAddress: string,
        quoteAddress: string,
        referenceCEXVenue: string,
        referenceCEXBaseTicker: string,
        referenceCEXQuoteTicker: string,
        pollInterval: number = 5000, // Poll every 5 seconds by default
        orderLadderSize: number = 3, // Default to 3 levels of orders on each side (bid/ask)
        priceStepFactor: number = 0.0005 // Note in this strategy, current bid ask spread based on
    ) {
        this.chainID = chainID;
        this.userAddress = walletWithProvider.address;
        this.baseAddress = baseAddress;
        this.quoteAddress = quoteAddress;
        this.provider = walletWithProvider.provider!;
        this.walletWithProvider = walletWithProvider;
        this.pollInterval = pollInterval;
        this.orderLadderSize = orderLadderSize;
        this.priceStepFactor = priceStepFactor;
        this.referenceCEXBaseTicker = referenceCEXBaseTicker;
        this.referenceCEXQuoteTicker = referenceCEXQuoteTicker;

        // Initialize connectors
        this.rubiconConnector = new RubiconConnector(
            chainID,
            walletWithProvider,
            this.userAddress,
            baseAddress,
            quoteAddress
        );
        if (referenceCEXVenue !== "kraken") {
            throw new Error(`Reference CEX venue ${referenceCEXVenue} not supported, just kraken for now`);
        }

        this.referenceVenueConnector = new KrakenReferenceVenue(referenceCEXBaseTicker, referenceCEXQuoteTicker);

        this.rubiconBookWatcher = new RubiconBookTracker(
            chainID,
            this.userAddress,
            baseAddress,
            quoteAddress
        );
    }

    // Run the strategy by polling the market and managing orders
    async runStrategy() {
        console.log("Running CEX Market Making Strategy");

        this.rubiconBookWatcher.pollForBookUpdates(this.pollInterval / 2);
        var gate = false;
        setInterval(async () => {
            try {
                // Step 1: Fetch CEX prices (e.g., from Kraken)
                const midPrice = await this.referenceVenueConnector.getMidPointPrice();
                if (!midPrice) {
                    console.error("Failed to get mid-point price from CEX");
                    return;
                }
                console.log(`Mid-point price from CEX: ${midPrice}`);

                // Step 2: Fetch current Rubicon order book
                // await this.rubiconBookWatcher.fetchOrderBook();

                const rubiBook = this.rubiconBookWatcher.userBook;
                console.log("Live order book", rubiBook);

                const bestAsk: number | undefined = rubiBook.asks[0] ? rubiBook.asks[0].price : undefined;
                const bestBid: number | undefined = rubiBook.bids[0] ? rubiBook.bids[0].price : undefined;

                console.log(`Best Ask on Rubicon: ${bestAsk}, Best Bid on Rubicon: ${bestBid}`);

                // Step 3: Build desired book using ladder logic
                const desiredBook = this.buildDesiredBook(midPrice);

                console.log("Desired book", desiredBook);
                // Step 4: Update orders on Rubicon
                if (gate) {
                    console.log("Gate is up, skipping order update");
                    return;
                }
                gate = true;
                try {
                    
                    await this.updateRubiconOrders(desiredBook);
                } catch (error) {
                    console.log("Error updating orders", error);
                    gate = false;
                    
                }
                gate = false;

            } catch (error) {
                console.error("Error in market-making strategy:", error);
            }
        }, this.pollInterval); // Polling interval for the strategy
    }

    // Build a ladder of orders around the mid-price from the reference CEX
    private buildDesiredBook(midPrice: number): { bids: { price: number, size: number }[], asks: { price: number, size: number }[] } {
        const bidPrices: { price: number, size: number }[] = [];
        const askPrices: { price: number, size: number }[] = [];

        // Configure initial sizes for orders
        const totalAssetBalance = this.rubiconConnector.onChainAvailableAssetBalance;
        const totalQuoteBalance = this.rubiconConnector.onChainAvailableQuoteBalance;

        // Simple ladder logic for bids and asks (you can customize this)
        for (let i = 0; i < this.orderLadderSize; i++) {
            const priceStep = midPrice * (this.priceStepFactor * (i + 1)); // Example price increment/decrement TODO: extrapolate to config
            const bidPrice = midPrice - priceStep;
            const askPrice = midPrice + priceStep;

            const bidSize = (totalQuoteBalance / (this.orderLadderSize)) / bidPrice; // Example size calculation
            const askSize = totalAssetBalance / this.orderLadderSize; // Example size calculation

            bidPrices.push({ price: bidPrice, size: bidSize });
            askPrices.push({ price: askPrice, size: askSize });
        }

        return {
            bids: bidPrices,
            asks: askPrices
        };
    }

    // Compare and update the Rubicon order book
    private async updateRubiconOrders(desiredBook: { bids: { price: number, size: number }[], asks: { price: number, size: number }[] }) {
        const currentBids = this.rubiconBookWatcher.userBook.bids;
        const currentAsks = this.rubiconBookWatcher.userBook.asks;

        const updatePromises: Promise<any>[] = [];

        // Check bids
        for (let i = 0; i < desiredBook.bids.length; i++) {
            const desiredBid = desiredBook.bids[i];
            const currentBid = currentBids[i];

            if (!desiredBid) {
                return
            }

            if (!currentBid || Math.abs(currentBid.price - desiredBid.price) > 0.00001 || currentBid.size !== desiredBid.size) {
                console.log(`Updating bid at price: ${desiredBid.price}, size: ${desiredBid.size}`);
                // Min order size check
                if (MIN_ORDER_SIZES[this.rubiconConnector.quote.symbol] > desiredBid.size * desiredBid.price) {
                    console.log(`Minimum order size for ${this.rubiconConnector.quote.symbol} is ${MIN_ORDER_SIZES[this.rubiconConnector.quote.symbol]} skipping order`);
                    return;
                }

                if (currentBid) {
                    updatePromises.push(this.rubiconConnector.editOrder(currentBid.hash, desiredBid.size, desiredBid.price, true));
                } else {
                    updatePromises.push(this.rubiconConnector.placeOrder(desiredBid.size, desiredBid.price, true));
                }
            }
        }

        // Cancel any extra bids
        for (let i = desiredBook.bids.length; i < currentBids.length; i++) {
            console.log(`Cancelling bid at price: ${currentBids[i].price}, size: ${currentBids[i].size}`);
            updatePromises.push(this.rubiconConnector.cancelOrder(currentBids[i].hash));
        }

        // Check asks
        for (let i = 0; i < desiredBook.asks.length; i++) {
            const desiredAsk = desiredBook.asks[i];
            const currentAsk = currentAsks[i];
            if (!desiredAsk) {
                return
            }
            // Min order size check
            if (MIN_ORDER_SIZES[this.rubiconConnector.base.symbol] > desiredAsk.size) {
                console.log(`Minimum order size for ${this.rubiconConnector.base.symbol} is ${MIN_ORDER_SIZES[this.rubiconConnector.base.symbol]} skipping order`);
                return;
            }
            if (!currentAsk || Math.abs(currentAsk.price - desiredAsk.price) > 0.00001 || currentAsk.size !== desiredAsk.size) {
                console.log(`Updating ask at price: ${desiredAsk.price}, size: ${desiredAsk.size}`);
                if (currentAsk) {
                    updatePromises.push(this.rubiconConnector.editOrder(currentAsk.hash, desiredAsk.size, desiredAsk.price, false));
                } else {
                    updatePromises.push(this.rubiconConnector.placeOrder(desiredAsk.size, desiredAsk.price, false));
                }
            }
        }

        // Cancel any extra asks
        for (let i = desiredBook.asks.length; i < currentAsks.length; i++) {
            console.log(`Cancelling ask at price: ${currentAsks[i].price}, size: ${currentAsks[i].size}`);
            updatePromises.push(this.rubiconConnector.cancelOrder(currentAsks[i].hash));
        }

        await Promise.all(updatePromises);
    }
}
