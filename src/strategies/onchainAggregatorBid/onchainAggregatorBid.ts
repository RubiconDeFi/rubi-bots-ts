import { TokenInfo } from '@uniswap/token-lists';
import { ODOSReferenceVenue } from '../../referenceVenues/odos';
import { ethers } from 'ethers';
import { KrakenReferenceVenue } from '../../referenceVenues/kraken';
import ERC20_ABI from "../../constants/ERC20.json";
import { OfferStatus, RubiconClassicConnector } from '../../connectors/rubionClassic';
import { getSimpleBookFromOnchainPosition } from '../../utils/rubicon';
import { formatUnits } from 'ethers/lib/utils';

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
        marketAddress: string
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
            baseToken.address,
            quoteToken.address
        )
        this.breifStartupWait();
    }

    private async breifStartupWait() {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.rubiconClassicConnector.checkApprovals();
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
        // current positioning
        const onchainBook = getSimpleBookFromOnchainPosition(onchainPositioning, this.baseToken, this.quoteToken);

        console.log('Onchain Book:', onchainBook);

        // 4. Update logic
        const volatilityThreshold = 0.02; // 2% threshold, adjust as needed
        const krakenBestBid = (krakenData.bids[0].price);
        const krakenBestAsk = (krakenData.asks[0].price);
        const isHighVolatility = Math.abs(krakenBestAsk - krakenBestBid) / krakenBestBid > volatilityThreshold;

        if (isHighVolatility) {
            // 4.1 If it is a high volatility period, remove orders from book
            await this.removeAllOrders(onchainPositioning);
        } else {
            console.log('LOW VOLATILITY PROCEED TO QUOTE');
            // IF ODOS price data is crossed, we just use Kraken data
            // TOOD: THIS NEEDS WORK....
            // NEED TO OUTBID ODOS WHEN It's Not offsides from Kaken, otherwise fall back to Krakn...
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

            // TODO: handl case where they're crossed!!!

            // IF no offer oustanding, place initial orders
            if (onchainBook.bids.length === 0 && onchainBook.asks.length === 0) {
                console.log('No onchain offers outstanding, placing initial orders');

                return await this.updateOrders(onchainPositioning, newBid, newAsk);
            }

            // 4.2 If it is a low volatility period, add or update orders to book that outbid ODOS spread

            // 4.3 Check if the new positioning is too offsides based on Kraken data
            const krakenMidPrice = (krakenBestBid + krakenBestAsk) / 2;
            const maxDeviation = 0.01; // 1% max deviation from Kraken mid price

            if (Math.abs(newBid - krakenMidPrice) / krakenMidPrice <= maxDeviation &&
                Math.abs(newAsk - krakenMidPrice) / krakenMidPrice <= maxDeviation) {
                // DO NOTHING BECAUSE IN POSITION!
                console.log('DO NOTHING BECAUSE THINK IN POSITION!');
                return;
            } else {
                console.log('New positioning too offsides REQUOTE');
                // Use Kraken mid price to set orders when ODOS data is too offsides
                await this.updateOrders(onchainPositioning, newBid, newAsk);
            }
        }
    }

    private async removeAllOrders(onchainPositioning: OfferStatus[]): Promise<void> {
        const orderIds = onchainPositioning.map(offer => offer.id);
        if (orderIds.length > 0) {
            await this.rubiconClassicConnector.batchCancel(orderIds);
            console.log('Removed all orders due to high volatility');
        }
    }

    private async updateOrders(onchainPositioning: OfferStatus[], newBid: number, newAsk: number): Promise<void> {
        const orderIds: ethers.BigNumber[] = [];
        const payAmts: ethers.BigNumber[] = [];
        const payGems: string[] = [];
        const buyAmts: ethers.BigNumber[] = [];
        const buyGems: string[] = [];

        // Get balances from RubiconClassicConnector
        // THESE ARE FUNDS NOT ON BOOK
        const baseBalance = this.rubiconClassicConnector.getBaseTokenBalance();
        const quoteBalance = this.rubiconClassicConnector.getQuoteTokenBalance();

        // Prepare batch requote for existing orders
        for (const offer of onchainPositioning) {
            orderIds.push(offer.id);
            if (offer.payGem === this.baseToken.address) {
                // This is an ask order
                const baseBalanceAndOnBook = baseBalance.add(offer.payAmt);
                const newPayAmt = baseBalanceAndOnBook;
                const newBuyAmt = ethers.utils.parseUnits((parseFloat(formatUnits(newPayAmt, this.baseToken.decimals)) * newAsk).toFixed(this.quoteToken.decimals), this.quoteToken.decimals);
                payAmts.push(newPayAmt);
                payGems.push(this.baseToken.address);
                buyAmts.push(newBuyAmt);
                buyGems.push(this.quoteToken.address);
            } else {
                // This is a bid order
                const quoteBalanceAndOnBook = quoteBalance.add(offer.payAmt);
                const newBuyAmt = ethers.utils.parseUnits((parseFloat(formatUnits(quoteBalanceAndOnBook, this.quoteToken.decimals)) / newBid).toFixed(this.baseToken.decimals), this.baseToken.decimals);
                const newPayAmt = quoteBalanceAndOnBook;
                payAmts.push(newPayAmt);
                payGems.push(this.quoteToken.address);
                buyAmts.push(newBuyAmt);
                buyGems.push(this.baseToken.address);
            }
        }

        // Add new orders if necessary
        if (orderIds.length === 0) {
            // Add new bid order
            const bidBuyAmt = ethers.utils.parseUnits((parseFloat(formatUnits(quoteBalance, this.quoteToken.decimals)) / newBid).toFixed(this.baseToken.decimals), this.baseToken.decimals);
            const bidPayAmt = quoteBalance
            payAmts.push(bidPayAmt);
            payGems.push(this.quoteToken.address);
            buyAmts.push(bidBuyAmt);
            buyGems.push(this.baseToken.address);

            // Add new ask order
            const askPayAmt = baseBalance;
            const askBuyAmt = ethers.utils.parseUnits((parseFloat(formatUnits(askPayAmt, this.baseToken.decimals)) * newAsk).toFixed(this.quoteToken.decimals), this.quoteToken.decimals);
            payAmts.push(askPayAmt);
            payGems.push(this.baseToken.address);
            buyAmts.push(askBuyAmt);
            buyGems.push(this.quoteToken.address);
        }

        // Execute batch requote or offer
        if (orderIds.length > 0) {
            console.log('orderIds', orderIds);
        
            console.log('payAmts', payAmts);
            console.log('payGems', payGems);
            console.log('buyAmts', buyAmts);
            console.log('buyGems', buyGems);
            await this.rubiconClassicConnector.batchRequote(orderIds, payAmts, payGems, buyAmts, buyGems);
        } else {
            console.log('No orders to requote, placing new orders'
            );
            // LOG
            console.log('payAmts', payAmts);
            console.log('payGems', payGems);
            console.log('buyAmts', buyAmts);
            console.log('buyGems', buyGems);
            await this.rubiconClassicConnector.batchOffer(payAmts, payGems, buyAmts, buyGems);
        }

        console.log('Updated orders with new bid/ask prices');
    }

    async getODOSBidAsk(): Promise<{ bestBid: number, bestAsk: number, midPointPrice: number } | undefined> {
        try {
            const bestBidAndAsk = await this.odosReferenceVenue.getBestBidAndAskBasedOnSize(1, 2500);
            // const midPointPrice = await this.odosReferenceVenue.getMidPointPrice();
            // const bestBidAndAsk = await this.odosReferenceVenue.getBestBidAndAsk();
            const bestBid = bestBidAndAsk?.bids[0].price!;
            const bestAsk = bestBidAndAsk?.asks[0].price!;
            const midPointPrice = (bestBid + bestAsk) / 2;


            // console.log('ODOS Reference Venue Information:');
            // console.log(`Best Bid: ${bestBid}`);
            // console.log(`Best Ask: ${bestAsk}`);
            // console.log(`Mid Point Price: ${midPointPrice}`);
            // console.log('Best Bid and Ask:', bestBidAndAsk);

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
        // For now, always return true to test the strategy
        return this.startupFinished;
    }

    getName(): string {
        return 'OnchainAggregatorBidStrategy';
    }
}
