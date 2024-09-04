// src/strategies/ammOutBid/AMMOutBid.ts
import { ethers, BigNumber } from "ethers";
import { UniswapReferenceVenue } from "../../referenceVenues/uni";
import { RubiconConnector } from "../../connectors/rubicon";
import { RubiconBookTracker } from "../../referenceVenues/rubicon";
import { MIN_ORDER_SIZES } from "../../config/rubicon";
import { TokenInfo } from "@uniswap/token-lists";
import { Network } from "../../config/tokens";
import { getTokenInfoFromAddress } from "../../utils/rubicon";
import QUOTER_INTERFACE from "../../constants/Quoter";
import QUOTER_INTERFACE_V2 from "../../constants/Quoterv2";

export class AMMOutBid {
    chainID: number;
    userAddress: string;
    baseAddress: string;
    quoteAddress: string;
    provider: ethers.providers.Provider;
    isV2: boolean;
    quoterContractAddress: string;
    uniFee: BigNumber;
    uniswapVenue: UniswapReferenceVenue;
    rubiconConnector: RubiconConnector;
    rubiconBookWatcher: RubiconBookTracker;
    walletWithProvider: ethers.Wallet;

    pollInterval: number;
    orderLadderSize: number;
    priceLadderFactor: number;

    constructor(
        chainID: number,
        walletWithProvider: ethers.Wallet,
        userAddress: string,
        baseAddress: string,
        quoteAddress: string,
        uniFee: BigNumber,
        pollInterval: number = 5000,
        orderLadderSize: number = 3,
        priceLadderFactor: number = 0.0005,
        isUNIv2Pair: boolean = false
    ) {
        this.chainID = chainID;
        this.userAddress = userAddress;
        this.baseAddress = baseAddress;
        this.quoteAddress = quoteAddress;
        this.provider = walletWithProvider.provider!;
        this.walletWithProvider = walletWithProvider;
        this.pollInterval = pollInterval;
        this.orderLadderSize = orderLadderSize;
        this.priceLadderFactor = priceLadderFactor;
        this.uniFee = uniFee;

        var isV2 = false; // Default to V1

        if (chainID === Network.BASE_MAINNET) {
            isV2 = true;
        }

        const quoterContractAddress = isV2
            ? "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a"
            : "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
        const quoterInterface = isV2 ? QUOTER_INTERFACE_V2 : QUOTER_INTERFACE;

        this.isV2 = isV2;
        this.quoterContractAddress = quoterContractAddress;

        const baseTokenInfo = getTokenInfoFromAddress(this.baseAddress, this.chainID);
        const quoteTokenInfo = getTokenInfoFromAddress(this.quoteAddress, this.chainID);

        this.uniswapVenue = new UniswapReferenceVenue(
            baseAddress,
            quoteAddress,
            this.provider,
            isV2,
            baseTokenInfo,
            quoteTokenInfo,
            uniFee,
            new ethers.Contract(quoterContractAddress, quoterInterface, this.provider),
            isUNIv2Pair
        );

        this.rubiconConnector = new RubiconConnector(
            chainID,
            walletWithProvider,
            userAddress,
            baseAddress,
            quoteAddress
        );

        this.rubiconBookWatcher = new RubiconBookTracker(
            chainID,
            userAddress,
            baseAddress,
            quoteAddress
        );

        console.log("🔥 AMMOutBid strategy initialized with these parameters:");
        console.log("Chain ID:", chainID);
        console.log("User Address:", userAddress);
        console.log("Base Address:", baseAddress);
        console.log("Quote Address:", quoteAddress);
        console.log("Poll Interval:", pollInterval);
        console.log("Order Ladder Size:", orderLadderSize);
        console.log("Price Ladder Factor:", priceLadderFactor);
    }

    // Run the strategy by polling the market and managing orders
    async runStrategy() {
        console.log("Running AMMOutBid Strategy");

        this.rubiconBookWatcher.pollForBookUpdates(this.pollInterval / 2);
        let gate = false;
        setInterval(async () => {
            try {
                // Step 1: Fetch Uniswap prices
                const midPrice = await this.uniswapVenue.getMidPointPrice();
                if (!midPrice) {
                    console.error("Failed to get mid-point price from Uniswap");
                    return;
                }
                console.log(`Mid-point price from Uniswap: ${midPrice}`);

                // Step 2: Fetch current Rubicon order book
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
                console.error("Error in AMMOutBid strategy:", error);
            }
        }, this.pollInterval);
    }

    // Build a ladder of orders around the mid-price from Uniswap
    private buildDesiredBook(midPrice: number): { bids: { price: number, size: number }[], asks: { price: number, size: number }[] } {
        const bidPrices: { price: number, size: number }[] = [];
        const askPrices: { price: number, size: number }[] = [];

        // Configure initial sizes for orders
        const totalAssetBalance = this.rubiconConnector.onChainAvailableAssetBalance;
        const totalQuoteBalance = this.rubiconConnector.onChainAvailableQuoteBalance;

        for (let i = 0; i < this.orderLadderSize; i++) {
            // TODO: this key variable should be configurable
            const priceStep = midPrice * (this.priceLadderFactor * (i + 1));
            const bidPrice = midPrice - priceStep;
            const askPrice = midPrice + priceStep;

            // TODO: this reducer number should be configurable
            const bidSize = ((totalQuoteBalance / (this.orderLadderSize)) / bidPrice) * 0.8;
            const askSize = (totalAssetBalance / this.orderLadderSize) * 0.8;

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

            if (!desiredBid) continue;

            if (!currentBid || Math.abs(currentBid.price - desiredBid.price) > 0.00001 || currentBid.size !== desiredBid.size) {
                console.log(`Updating bid at price: ${desiredBid.price}, size: ${desiredBid.size}`);

                if (MIN_ORDER_SIZES[this.rubiconConnector.quote.symbol] > desiredBid.size * desiredBid.price) {
                    console.log(`Minimum order size for ${this.rubiconConnector.quote.symbol} is ${MIN_ORDER_SIZES[this.rubiconConnector.quote.symbol]} - skipping order`);
                    continue;
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

            if (!desiredAsk) continue;

            if (MIN_ORDER_SIZES[this.rubiconConnector.base.symbol] > desiredAsk.size) {
                console.log(`Minimum order size for ${this.rubiconConnector.base.symbol} is ${MIN_ORDER_SIZES[this.rubiconConnector.base.symbol]} - skipping order`);
                continue;
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
