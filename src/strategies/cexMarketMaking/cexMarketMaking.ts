import { ethers } from "ethers";
import { RubiconConnector } from "../../connectors/rubicon";
import { KrakenReferenceVenue } from "../../referenceVenues/kraken";
import { RubiconBookTracker } from "../../referenceVenues/rubicon";

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

    constructor(
        chainID: number,
        walletWithProvider: ethers.Wallet,
        userAddress: string,
        baseAddress: string,
        quoteAddress: string,
        referenceCEXVenue: string,
        referenceCEXBaseTicker: string,
        referenceCEXQuoteTicker: string,
        pollInterval: number = 5000, // Poll every 5 seconds by default
        orderLadderSize: number = 3 // Default to 3 levels of orders on each side (bid/ask)
    ) {
        this.chainID = chainID;
        this.userAddress = userAddress;
        this.baseAddress = baseAddress;
        this.quoteAddress = quoteAddress;
        this.provider = walletWithProvider.provider!;
        this.walletWithProvider = walletWithProvider;
        this.pollInterval = pollInterval;
        this.orderLadderSize = orderLadderSize;
        this.referenceCEXBaseTicker = referenceCEXBaseTicker;
        this.referenceCEXQuoteTicker = referenceCEXQuoteTicker;

        // Initialize connectors
        this.rubiconConnector = new RubiconConnector(
            chainID,
            walletWithProvider,
            userAddress,
            baseAddress,
            quoteAddress
        );
        if (referenceCEXVenue !== "kraken") {
            throw new Error(`Reference CEX venue ${referenceCEXVenue} not supported, just kraken for now`);
        }

        this.referenceVenueConnector = new KrakenReferenceVenue(referenceCEXBaseTicker, referenceCEXQuoteTicker);

        this.rubiconBookWatcher = new RubiconBookTracker(
            chainID,
            userAddress,
            baseAddress,
            quoteAddress
        );
    }

    // Run the strategy by polling the market and managing orders
    async runStrategy() {
        console.log("Running CEX Market Making Strategy");

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
                await this.rubiconBookWatcher.fetchOrderBook();

                const rubiBook = this.rubiconBookWatcher.userBook;
                console.log("How is this sorted?", rubiBook);
                
                const bestAsk: number | undefined = rubiBook.asks[0].price ? rubiBook.asks[0].price : undefined;
                const bestBid: number | undefined = rubiBook.bids[0].price ? rubiBook.bids[0].price : undefined;

                console.log(`Best Ask on Rubicon: ${bestAsk}, Best Bid on Rubicon: ${bestBid}`);

                // Step 3: Build desired book using ladder logic
                const desiredBook = this.buildDesiredBook(midPrice);

                // Step 4: Update orders on Rubicon
                await this.updateRubiconOrders(desiredBook);

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
            const priceStep = midPrice * (0.0005 * (i + 1)); // Example price increment/decrement TODO: extrapolate to config
            const bidPrice = midPrice - priceStep;
            const askPrice = midPrice + priceStep;

            const bidSize = totalQuoteBalance / (this.orderLadderSize * bidPrice); // Example size calculation
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

        // Check bids
        for (let i = 0; i < desiredBook.bids.length; i++) {
            const desiredBid = desiredBook.bids[i];
            const currentBid = currentBids[i];

            if (!currentBid || Math.abs(currentBid.price - desiredBid.price) > 0.00001 || currentBid.size !== desiredBid.size) {
                console.log(`Updating bid at price: ${desiredBid.price}, size: ${desiredBid.size}`);
                if (currentBid) {
                    await this.rubiconConnector.editOrder(currentBid.hash, desiredBid.size, desiredBid.price, true);
                } else {
                    await this.rubiconConnector.placeOrder(desiredBid.size, desiredBid.price, true);
                }
            }
        }

        // Check asks
        for (let i = 0; i < desiredBook.asks.length; i++) {
            const desiredAsk = desiredBook.asks[i];
            const currentAsk = currentAsks[i];

            if (!currentAsk || Math.abs(currentAsk.price - desiredAsk.price) > 0.00001 || currentAsk.size !== desiredAsk.size) {
                console.log(`Updating ask at price: ${desiredAsk.price}, size: ${desiredAsk.size}`);
                if (currentAsk) {
                    await this.rubiconConnector.editOrder(currentAsk.hash, desiredAsk.size, desiredAsk.price, false);
                } else {
                    await this.rubiconConnector.placeOrder(desiredAsk.size, desiredAsk.price, false);
                }
            }
        }
    }
}
