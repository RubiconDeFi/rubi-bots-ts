// venues/uniswap.ts
import { MarketVenue } from '../types/MarketVenue';
import { ethers, BigNumber } from 'ethers';
import { SimpleBook } from '../types/rubicon';
import { tickToBook, tickToBook_UniV2, buildBook, getUNIReferenceRate } from '../utils/uni';
import { TokenInfo } from '@uniswap/token-lists';
import { generateLadderSizesInWei } from '../utils/uni';
import { getUSDfromCB } from '../utils/rubicon';
import { formatUnits } from 'ethers/lib/utils';

export class UniswapReferenceVenue implements MarketVenue {
    private pairAddress: string;
    private provider: ethers.providers.Provider;
    private isV2Quoter: boolean;
    private isUNIv2: boolean;
    private quoterContract: ethers.Contract;
    private uniFee: BigNumber;
    private token: TokenInfo;
    private quote: TokenInfo;

    constructor(
        baseAddress: string,
        quoteAddress: string,
        provider: ethers.providers.Provider,
        isV2: boolean,
        token: TokenInfo,
        quote: TokenInfo,
        uniFee: BigNumber,
        quoterContract: ethers.Contract,
        isUNIv2: boolean = false
    ) {
        this.provider = provider;
        this.isV2Quoter = isV2;
        this.token = token;
        this.quote = quote;
        this.uniFee = uniFee;
        this.quoterContract = quoterContract
        this.pairAddress = this.calculateUniswapPairAddress(baseAddress, quoteAddress);
        this.isUNIv2 = isUNIv2;
    }

    private calculateUniswapPairAddress(baseAddress: string, quoteAddress: string): string {
        // Logic to calculate pair address on Uniswap
        // Assuming a simple concatenation for this example
        return `${baseAddress}_${quoteAddress}`;
    }

    // TODO: more of this stuff should be easily configured
    private async fetchUniswapOrderBook(): Promise<SimpleBook | undefined | void | any> {
        const pairedQuoteUSD = await getUSDfromCB(this.quote);
        if (!pairedQuoteUSD) {
            console.error(`Could not find USD price for ${this.quote.symbol}`);
            return;
        }
        // console.log(`Paired Quote USD: ${pairedQuoteUSD}`);
        
        const referenceRate = await getUNIReferenceRate(this.token, this.quote, parseFloat(pairedQuoteUSD.toString()), this.provider); 
        // console.log('Reference Rate:', referenceRate);
        const tokenUSDRef = referenceRate! * parseFloat(pairedQuoteUSD.toString());
        // console.log('Token USD Reference:', tokenUSDRef);
        
        const leftSizeLadderWei = generateLadderSizesInWei(referenceRate, 10, 1.2, this.quote.decimals, false, pairedQuoteUSD); 
        const rightSizeLadderWei = generateLadderSizesInWei(referenceRate, 10, 1.2, this.token.decimals, true, tokenUSDRef);
        
        // console.log('Left Size Ladder:', leftSizeLadderWei!.map((x) => formatUnits(x.toString(), this.quote.decimals)));
        // console.log('Right Size Ladder:', rightSizeLadderWei!.map((x) => formatUnits(x.toString(), this.token.decimals)));
        
        if (leftSizeLadderWei && rightSizeLadderWei) {
            // NOTE THIS IS UNIv2 vs UNIv3!!!!!
            if (this.isUNIv2) {
                const data = await tickToBook_UniV2(leftSizeLadderWei, rightSizeLadderWei, this.quoterContract, this.quote, this.token, this.uniFee, 1);
                // Sort the book so zero index is best bid or ask
                data.bids.sort((a, b) => b.price - a.price);
                data.asks.sort((a, b) => a.price - b.price);
                return data;
            } else {
                const data = await tickToBook(leftSizeLadderWei, rightSizeLadderWei, this.quoterContract, this.quote, this.token, this.uniFee, 1, this.isV2Quoter);
                // Sort the book so zero index is best bid or ask
                data.bids.sort((a, b) => b.price - a.price);
                data.asks.sort((a, b) => a.price - b.price);
                return data;
            }
        }
    }

    public async getBestBid(): Promise<number | null> {
        const book = await this.fetchUniswapOrderBook();
        return book?.bids.length ? book.bids[0].price : null;
    }

    public async getBestAsk(): Promise<number | null> {
        const book = await this.fetchUniswapOrderBook();
        return book?.asks.length ? book.asks[0].price : null;
    }

    public async getMidPointPrice(): Promise<number | null> {
        const [bestBid, bestAsk] = await Promise.all([this.getBestBid(), this.getBestAsk()]);
        if (bestBid === null || bestAsk === null) return null;
        return (bestBid + bestAsk) / 2;
    }

    public async getOrderBook(): Promise<SimpleBook | undefined> {
        return this.fetchUniswapOrderBook();
    }
}
