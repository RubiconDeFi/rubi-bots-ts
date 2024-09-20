import { TokenInfo } from '@uniswap/token-lists';
import { ODOSReferenceVenue } from '../../referenceVenues/odos';
import { ethers } from 'ethers';

export class OnchainAggregatorBidStrategy {
    private odosReferenceVenue: ODOSReferenceVenue;
    private baseToken: TokenInfo;
    private quoteToken: TokenInfo;

    constructor(
        baseSymbol: string,
        quoteSymbol: string,
        chainId: number,
        baseToken: TokenInfo,
        quoteToken: TokenInfo
    ) {
        this.baseToken = baseToken;
        this.quoteToken = quoteToken;
        this.odosReferenceVenue = new ODOSReferenceVenue(
            baseSymbol,
            quoteSymbol,
            chainId,
            baseToken,
            quoteToken
        );
    }

    async execute(provider: ethers.providers.Provider): Promise<void> {
        console.log('Executing OnchainAggregatorBidStrategy');

        try {
            const bestBid = await this.odosReferenceVenue.getBestBid();
            const bestAsk = await this.odosReferenceVenue.getBestAsk();
            const midPointPrice = await this.odosReferenceVenue.getMidPointPrice();
            const bestBidAndAsk = await this.odosReferenceVenue.getBestBidAndAsk();

            console.log('ODOS Reference Venue Information:');
            console.log(`Best Bid: ${bestBid}`);
            console.log(`Best Ask: ${bestAsk}`);
            console.log(`Mid Point Price: ${midPointPrice}`);
            console.log('Best Bid and Ask:', bestBidAndAsk);

        } catch (error) {
            console.error('Error executing OnchainAggregatorBidStrategy:', error);
        }
    }

    async shouldExecute(): Promise<boolean> {
        // For now, always return true to test the strategy
        return true;
    }

    getName(): string {
        return 'OnchainAggregatorBidStrategy';
    }
}
