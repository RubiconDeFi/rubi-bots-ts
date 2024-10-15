import { TokenInfo } from '@uniswap/token-lists';
import { ODOSReferenceVenue } from '../../referenceVenues/odos';
import { ethers } from 'ethers';
import { KrakenReferenceVenue } from '../../referenceVenues/kraken';
import { RubiconClassicConnector } from '../../connectors/rubionClassicMarketAid';
import { formatUnits } from 'ethers/lib/utils';
import { MIN_ORDER_SIZES } from '../../config/rubicon';

export class OnchainAggregatorBidStrategy {
    private odosReferenceVenue: ODOSReferenceVenue;
    private baseToken: TokenInfo;
    private quoteToken: TokenInfo;
    private krakenReferenceVenue: KrakenReferenceVenue;
    private provider: ethers.providers.Provider;
    private rubiconClassicConnector: RubiconClassicConnector;
    private startupFinished: boolean = false;
    private userWallet: ethers.Wallet;

    constructor(
        baseSymbol: string,
        quoteSymbol: string,
        chainId: number,
        baseToken: TokenInfo,
        quoteToken: TokenInfo,
        provider: ethers.providers.Provider,
        userWallet: ethers.Wallet,
        marketAddress: string,
        marketAidAddress: string
    ) {
        this.userWallet = userWallet;
        this.baseToken = baseToken;
        this.quoteToken = quoteToken;
        this.odosReferenceVenue = new ODOSReferenceVenue(
            baseSymbol,
            quoteSymbol,
            chainId,
            baseToken,
            quoteToken
        );
        this.provider = provider;
        this.krakenReferenceVenue = new KrakenReferenceVenue(
            baseSymbol,
            quoteSymbol,
        );
        this.rubiconClassicConnector = new RubiconClassicConnector(
            provider,
            userWallet,
            marketAddress,
            marketAidAddress,
            baseToken.address,
            quoteToken.address
        )
        this.breifStartupWait();
    }

    private async breifStartupWait() {
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Remove checkApprovals as it's not needed with MarketAid
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.startupFinished = true;
    }

    async execute(provider: ethers.providers.Provider): Promise<void> {
        console.log('Executing OnchainAggregatorBidStrategy');

        // 1. Get current Kraken market data
        const krakenData = await this.krakenReferenceVenue.getBestBidAndAsk();
        if (!krakenData || !krakenData.bids.length || !krakenData.asks.length) {
            console.log('No Kraken data available, skipping execution');
            return;
        }

        // 2. Get current ODOS market data
        const odosData = await this.getODOSBidAsk();
        if (!odosData) {
            console.log('No ODOS data available, skipping execution');
            return;
        }

        console.log('Kraken Data:', krakenData);
        console.log('ODOS Data:', odosData);

        // 3. Check current onchain positioning
        const onchainPositioning = this.rubiconClassicConnector.getOutstandingOffers();
        // console.log('Onchain Positioning:', onchainPositioning);

        // 4. Update logic
        // TODO: SOLVE FOR THIS VALUE
        const volatilityThreshold = 0.02; // 2% threshold, adjust as needed
        const krakenBestBid = (krakenData.bids[0].price);
        const krakenBestAsk = (krakenData.asks[0].price);
        const isHighVolatility = Math.abs(krakenBestAsk - krakenBestBid) / krakenBestBid > volatilityThreshold;

        if (isHighVolatility) {
            // 4.1 If it is a high volatility period, remove orders from book
            await this.removeAllOrders();
        } else {
            console.log('LOW VOLATILITY PROCEED TO QUOTE');
            // IF ODOS price data is crossed, we just use Kraken data
            var newBid;
            var newAsk;
            if (odosData.bestBid > odosData.bestAsk) {
                newBid = krakenBestBid;
                newAsk = krakenBestAsk;
            } else {
                const bidOUTBIDCAND = odosData.bestBid * 1.00011; // Outbid by 1 bp + a tiny bit
                const askOUTBIDCAND = odosData.bestAsk * 0.99989; // Underbid by 1 bp - a tiny bit
                // IF THESE ARE CROSSED, then do Kraken data
                if (bidOUTBIDCAND > askOUTBIDCAND) {
                    newBid = krakenBestBid;
                    newAsk = krakenBestAsk;
                } else {
                    newBid = bidOUTBIDCAND;
                    newAsk = askOUTBIDCAND;
                }
            }

            if (newBid > newAsk) {
                throw new Error("newBid > newAsk, this shouldn't happen");
            }
            console.log("TARGETTING THIS OUTBID SPREAD, bid, ask:", newBid, newAsk);

            // IF no offer outstanding, place initial orders
            if (onchainPositioning.length === 0) {
                console.log('\n🌻No onchain offers outstanding, placing initial orders');
                return await this.placeInitialOrders(newBid, newAsk);
            }

            // 4.2 If it is a low volatility period, add or update orders to book that outbid ODOS spread
            // 4.3 Check if the new positioning is too offsides based on Kraken data
            const krakenMidPrice = (krakenBestBid + krakenBestAsk) / 2;
            const maxDeviation = 0.01; // 1% max deviation from Kraken mid price

            if (Math.abs(newBid - krakenMidPrice) / krakenMidPrice <= maxDeviation &&
                Math.abs(newAsk - krakenMidPrice) / krakenMidPrice <= maxDeviation) {
                console.log('DO NOTHING BECAUSE THINK IN POSITION!');
                return;
            } else {
                console.log('\n📐 New positioning too offsides REQUOTE');
                await this.updateOrders(newBid, newAsk);
            }
        }
    }

    private async removeAllOrders(): Promise<void> {
        const outstandingUIDs = this.rubiconClassicConnector.getOutstandingUIDs();
        if (outstandingUIDs.length > 0) {
            await this.rubiconClassicConnector.batchCancel(outstandingUIDs);
            console.log('Removed all orders due to high volatility');
        }
    }

    private async placeInitialOrders(newBid: number, newAsk: number): Promise<void> {
        const baseBalance = this.rubiconClassicConnector.getBaseTokenBalance();
        const quoteBalance = this.rubiconClassicConnector.getQuoteTokenBalance();

        const bidBuyAmt = ethers.utils.parseUnits((parseFloat(formatUnits(quoteBalance, this.quoteToken.decimals)) / newBid).toFixed(this.baseToken.decimals), this.baseToken.decimals);
        const bidPayAmt = quoteBalance;
        const askPayAmt = baseBalance;
        const askBuyAmt = ethers.utils.parseUnits((parseFloat(formatUnits(askPayAmt, this.baseToken.decimals)) * newAsk).toFixed(this.quoteToken.decimals), this.quoteToken.decimals);

        const MIN_BASE_SIZE = ethers.utils.parseUnits(MIN_ORDER_SIZES[this.baseToken.symbol].toString(), this.baseToken.decimals);
        const MIN_QUOTE_SIZE = ethers.utils.parseUnits(MIN_ORDER_SIZES[this.quoteToken.symbol].toString(), this.quoteToken.decimals);

        const finalAskPayAmt = askPayAmt.gte(MIN_BASE_SIZE) ? askPayAmt : ethers.BigNumber.from('0');
        const finalAskBuyAmt = askPayAmt.gte(MIN_BASE_SIZE) ? askBuyAmt : ethers.BigNumber.from('0');
        const finalBidPayAmt = bidPayAmt.gte(MIN_QUOTE_SIZE) ? bidPayAmt : ethers.BigNumber.from('0');
        const finalBidBuyAmt = bidPayAmt.gte(MIN_QUOTE_SIZE) ? bidBuyAmt : ethers.BigNumber.from('0');

        console.log("Placing initial orders with these values: ", [finalAskPayAmt], [finalAskBuyAmt], [finalBidPayAmt], [finalBidBuyAmt]);
        
        await this.rubiconClassicConnector.batchOffer(
            [finalAskPayAmt],
            [finalAskBuyAmt],
            [finalBidPayAmt],
            [finalBidBuyAmt]
        );
    }

    private async updateOrders(newBid: number, newAsk: number): Promise<void> {
        const outstandingUIDs = this.rubiconClassicConnector.getOutstandingUIDs();
        const baseBalance = this.rubiconClassicConnector.getBaseTokenBalance();
        const quoteBalance = this.rubiconClassicConnector.getQuoteTokenBalance();

        const bidBuyAmt = ethers.utils.parseUnits((parseFloat(formatUnits(quoteBalance, this.quoteToken.decimals)) / newBid).toFixed(this.baseToken.decimals), this.baseToken.decimals);
        const bidPayAmt = quoteBalance;
        const askPayAmt = baseBalance;
        const askBuyAmt = ethers.utils.parseUnits((parseFloat(formatUnits(askPayAmt, this.baseToken.decimals)) * newAsk).toFixed(this.quoteToken.decimals), this.quoteToken.decimals);

        const MIN_BASE_SIZE = ethers.utils.parseUnits(MIN_ORDER_SIZES[this.baseToken.symbol].toString(), this.baseToken.decimals);
        const MIN_QUOTE_SIZE = ethers.utils.parseUnits(MIN_ORDER_SIZES[this.quoteToken.symbol].toString(), this.quoteToken.decimals);

        const finalAskPayAmt = askPayAmt.gte(MIN_BASE_SIZE) ? askPayAmt : ethers.BigNumber.from('0');
        const finalAskBuyAmt = askPayAmt.gte(MIN_BASE_SIZE) ? askBuyAmt : ethers.BigNumber.from('0');
        const finalBidPayAmt = bidPayAmt.gte(MIN_QUOTE_SIZE) ? bidPayAmt : ethers.BigNumber.from('0');
        const finalBidBuyAmt = bidPayAmt.gte(MIN_QUOTE_SIZE) ? bidBuyAmt : ethers.BigNumber.from('0');

        if (outstandingUIDs.length > 0) {
            await this.rubiconClassicConnector.batchRequote(
                outstandingUIDs,
                [finalAskPayAmt],
                [finalAskBuyAmt],
                [finalBidPayAmt],
                [finalBidBuyAmt]
            );
        } else {
            await this.placeInitialOrders(newBid, newAsk);
        }
    }

    async getODOSBidAsk(): Promise<{ bestBid: number, bestAsk: number, midPointPrice: number } | undefined> {
        try {
            const bestBidAndAsk = await this.odosReferenceVenue.getBestBidAndAskBasedOnSize(1, 2500);
            const bestBid = bestBidAndAsk?.bids[0].price!;
            const bestAsk = bestBidAndAsk?.asks[0].price!;
            const midPointPrice = (bestBid + bestAsk) / 2;

            return {
                bestBid,
                bestAsk,
                midPointPrice
            };

        } catch (error) {
            console.error('Error executing OnchainAggregatorBidStrategy:', error);
        }
    }

    async shouldExecute(): Promise<boolean> {
        return this.startupFinished;
    }

    getName(): string {
        return 'OnchainAggregatorBidStrategy';
    }
}