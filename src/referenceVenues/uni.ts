// venues/uniswap.ts
import { MarketVenue } from '../types/MarketVenue';
import { ethers, BigNumber } from 'ethers';
import { SimpleBook } from '../types/rubicon';
import { tickToBook, tickToBook_UniV2, buildBook, getUNIReferenceRate } from '../utils/uni';
import { TokenInfo } from '@uniswap/token-lists';
import { generateLadderSizesInWei } from '../utils/uni';

export class UniswapReferenceVenue implements MarketVenue {
    private pairAddress: string;
    private provider: ethers.providers.Provider;
    private isV2: boolean;
    private quoterContract: ethers.Contract;
    private uniFee: BigNumber;
    private token: TokenInfo;
    private quote: TokenInfo;

    constructor(
        baseAddress: string,
        quoteAddress: string,
        providerUrl: string,
        isV2: boolean,
        token: TokenInfo,
        quote: TokenInfo,
        uniFee: BigNumber,
        quoterContractAddress: string,
        quoterInterface: ethers.utils.Interface,
    ) {
        this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
        this.isV2 = isV2;
        this.token = token;
        this.quote = quote;
        this.uniFee = uniFee;
        this.quoterContract = new ethers.Contract(quoterContractAddress, quoterInterface, this.provider);
        this.pairAddress = this.calculateUniswapPairAddress(baseAddress, quoteAddress);
    }

    private calculateUniswapPairAddress(baseAddress: string, quoteAddress: string): string {
        // Logic to calculate pair address on Uniswap
        // Assuming a simple concatenation for this example
        return `${baseAddress}_${quoteAddress}`;
    }

    private async fetchUniswapOrderBook(): Promise<SimpleBook | undefined> {
        const referenceRate = await getUNIReferenceRate(this.token, this.quote, 1, this.provider); // Replace with actual logic
        const leftSizeLadderWei = generateLadderSizesInWei(referenceRate, 50, 1.2, this.quote.decimals, false); // Example params
        const rightSizeLadderWei = generateLadderSizesInWei(referenceRate, 50, 1.2, this.token.decimals, true); // Example params

        if (this.isV2) {
            return tickToBook_UniV2(leftSizeLadderWei, rightSizeLadderWei, this.quoterContract, this.quote, this.token, this.uniFee, 1);
        } else {
            return tickToBook(leftSizeLadderWei, rightSizeLadderWei, this.quoterContract, this.quote, this.token, this.uniFee, 1, this.isV2);
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
}
