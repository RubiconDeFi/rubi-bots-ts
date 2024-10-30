import { TokenInfo } from '@uniswap/token-lists';
import { ODOSReferenceVenue } from '../../referenceVenues/odos';
import { BigNumber, ethers } from 'ethers';
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

        const krakenBestBid = Number(krakenData.bids[0].price);
        const krakenBestAsk = Number(krakenData.asks[0].price);
        const krakenMidPrice = (krakenBestBid + krakenBestAsk) / 2;

        console.log(`Kraken Best Bid: ${krakenBestBid}, Best Ask: ${krakenBestAsk}, Mid Price: ${krakenMidPrice}`);

        // 2. Get current ODOS market data
        const odosData = await this.getODOSBidAsk(krakenMidPrice);
        if (!odosData) {
            console.log('No ODOS data available, skipping execution');
            return;
        }

        // 3. Check current onchain positioning
        const onchainPositioning = this.rubiconClassicConnector.getOutstandingOffers();
        // console.log('Onchain Positioning:', onchainPositioning);


        // Find positions that are all zeros and their corresponding UIDs
        const zeroPositionsWithUIDs = onchainPositioning.filter(offer => 
            offer.bidPay.eq(BigNumber.from('0')) && 
            offer.bidBuy.eq(BigNumber.from('0')) && 
            offer.askPay.eq(BigNumber.from('0')) && 
            offer.askBuy.eq(BigNumber.from('0'))
        );

        // If we found any zero positions, clean them up
        if (zeroPositionsWithUIDs.length > 0) {
            console.log(`Found ${zeroPositionsWithUIDs.length} zeroed positions, cleaning up...`);
            const zeroUIDs = zeroPositionsWithUIDs.map(offer => offer.relevantStratTradeId);
            if (zeroUIDs.length > 0) {
                await this.rubiconClassicConnector.batchCancel(zeroUIDs);
            }
            return; // Exit execution to allow the next cycle to proceed with clean state
        }

        // 4. Update logic
        // TODO: SOLVE FOR THIS VALUE
        const volatilityThreshold = 0.02; // 2% threshold, adjust as needed
        const isHighVolatility = Math.abs(krakenBestAsk - krakenBestBid) / krakenBestBid > volatilityThreshold;

        if (isHighVolatility) {
            // 4.1 If it is a high volatility period, remove orders from book
            await this.removeAllOrders();
        } else {
            console.log('LOW VOLATILITY PROCEED TO QUOTE');
            // IF ODOS price data is crossed, we just use Kraken data
            var newBid: number;
            var newAsk: number;
            if (odosData.bestBid > odosData.bestAsk) {
                newBid = Number(krakenBestBid);
                newAsk = Number(krakenBestAsk);
            } else {
                const bidOUTBIDCAND = odosData.bestBid * 1.00011; // Outbid by 1 bp + a tiny bit
                const askOUTBIDCAND = odosData.bestAsk * 0.99989; // Underbid by 1 bp - a tiny bit
                // IF THESE ARE CROSSED, then do Kraken data
                if (bidOUTBIDCAND > askOUTBIDCAND) {
                    newBid = Number(krakenBestBid);
                    newAsk = Number(krakenBestAsk);
                } else {
                    newBid = bidOUTBIDCAND;
                    newAsk = askOUTBIDCAND;
                }
            }

            if (newBid > newAsk) {
                throw new Error("newBid > newAsk, this shouldn't happen");
            }
            console.log("TARGETTING THIS OUTBID SPREAD, bid, ask:", newBid.toFixed(8), newAsk.toFixed(8));

            // IF no offer outstanding, place initial orders
            if (onchainPositioning.length === 0) {
                console.log('\n🌻No onchain offers outstanding, placing initial orders');
                return await this.placeInitialOrders(newBid, newAsk);
            }

            console.log('╔════════════════════════════════════════════════════════════╗');
            console.log('║                   Market Data Comparison                  ║');
            console.log('╠════════════════════════════════════════════════════════════╣');
            console.log('║ Venue  │      Best Bid      │      Best Ask      │  Spread ║');
            console.log('╟────────┼────────────────────┼────────────────────┼─────────╢');
            console.log(`║ Kraken │ ${Number(krakenData.bids[0].price).toFixed(8).padStart(18)} │ ${Number(krakenData.asks[0].price).toFixed(8).padStart(18)} │ ${(Number(krakenData.asks[0].price) - Number(krakenData.bids[0].price)).toFixed(8).padStart(7)} ║`);
            console.log(`║ ODOS   │ ${odosData.bestBid.toFixed(8).padStart(18)} │ ${odosData.bestAsk.toFixed(8).padStart(18)} │ ${(odosData.bestAsk - odosData.bestBid).toFixed(8).padStart(7)} ║`);
            console.log(`║ SELECT │ ${newBid.toFixed(8).padStart(18)} │ ${newAsk.toFixed(8).padStart(18)} │ ${(newAsk - newBid).toFixed(8).padStart(7)} ║`);
            console.log('╚════════════════════════════════════════════════════════════╝');


            // 4.2 If it is a low volatility period, add or update orders to book that outbid ODOS spread
            // 4.3 Check if the new positioning is too offsides based on Kraken data
            const maxDeviation = 0.01; // 1% max deviation from Kraken mid price
            console.log('kraken mid price:', krakenMidPrice);
            console.log('new bid:', newBid);
            console.log('new ask:', newAsk);

            // Convert onchain positioning to human-readable prices
            let currentBid: number | undefined;
            let currentAsk: number | undefined;

            console.log('onchain positioning:', onchainPositioning.map(offer => ({ bidPay: formatUnits(offer.bidPay, this.quoteToken.decimals), bidBuy: formatUnits(offer.bidBuy, this.baseToken.decimals), askPay: formatUnits(offer.askPay, this.baseToken.decimals), askBuy: formatUnits(offer.askBuy, this.quoteToken.decimals), UID: offer.relevantStratTradeId.toString() })));

            if (onchainPositioning.length > 0) {
                const bidOffer = onchainPositioning.find(offer => offer.bidPay.gt(0) && offer.bidBuy.gt(0));
                const askOffer = onchainPositioning.find(offer => offer.askPay.gt(0) && offer.askBuy.gt(0));

                if (bidOffer) {
                    const bidPayAmount = parseFloat(formatUnits(bidOffer.bidPay, this.quoteToken.decimals));
                    const bidBuyAmount = parseFloat(formatUnits(bidOffer.bidBuy, this.baseToken.decimals));
                    currentBid = bidPayAmount / bidBuyAmount;
                }

                if (askOffer) {
                    const askPayAmount = parseFloat(formatUnits(askOffer.askPay, this.baseToken.decimals));
                    const askBuyAmount = parseFloat(formatUnits(askOffer.askBuy, this.quoteToken.decimals));
                    currentAsk = askBuyAmount / askPayAmount;
                }
            }
            const bidDeviation = Math.abs(currentBid - krakenMidPrice) / krakenMidPrice;
            const askDeviation = Math.abs(currentAsk - krakenMidPrice) / krakenMidPrice;

            // Log the math that came to this conclusion
            console.log('╔════════════════════════════════════════════════════════════╗');
            console.log('║                   Market Data Comparison                  ║');
            console.log('╠════════════════════════════════════════════════════════════╣');
            console.log(`║ Kraken │ Mid Price:  ${krakenMidPrice.toFixed(8)}`);
            console.log(`║ BID UPPER BOUND   │  ${(krakenMidPrice * (1 + maxDeviation)).toFixed(8)}`);
            console.log(`║ ASK LOWER BOUND   │  ${(krakenMidPrice * (1 - maxDeviation)).toFixed(8)}`);
            console.log(`║ CURRENT │ BID:  ${currentBid?.toFixed(8) || 'N/A'} ASK:  ${currentAsk?.toFixed(8) || 'N/A'}`);
            console.log(`║ DELTA │ BID:  ${bidDeviation?.toFixed(8) || 'N/A'} ASK:  ${askDeviation?.toFixed(8) || 'N/A'}`);
            console.log('╚════════════════════════════════════════════════════════════╝');


            if (currentBid || currentAsk) {

                if (bidDeviation <= maxDeviation && askDeviation <= maxDeviation) {
                    console.log('Current positioning within acceptable range. No action needed.');
                    return;
                } else {
                    console.log('\n📐 Current positioning exceeds acceptable range. Requoting...');


                    await this.updateOrders(newBid, newAsk);
                }
            } else {
                console.log('\n🥳 No current positioning. Placing initial orders...');
                // Log the price and size of the initial orders
                console.log('Placing initial orders with these values: ', newBid, newAsk);
                await this.placeInitialOrders(newBid, newAsk);
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
        const baseBalance = this.rubiconClassicConnector.getBaseTokenBalance().mul(95).div(100);
        const quoteBalance = this.rubiconClassicConnector.getQuoteTokenBalance().mul(95).div(100);

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

        // console.log("Placing initial orders with these values: ", [finalAskPayAmt], [finalAskBuyAmt], [finalBidPayAmt], [finalBidBuyAmt]);

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

    async getODOSBidAsk(krakenMidPrice: number): Promise<{ bestBid: number, bestAsk: number, midPointPrice: number } | undefined> {
        try {
            const targetUsdAmount = 10000; // $10,000 worth
            const baseAmount = targetUsdAmount / krakenMidPrice;
            const quoteAmount = targetUsdAmount;

            console.log(`Querying ODOS with base amount: ${baseAmount.toFixed(4)} and quote amount: ${quoteAmount.toFixed(2)}`);

            const bestBidAndAsk = await this.odosReferenceVenue.getBestBidAndAskBasedOnSize(baseAmount, quoteAmount);
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
