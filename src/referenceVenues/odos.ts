import { MarketVenue } from '../types/MarketVenue';
import { SimpleBook } from '../types/rubicon';
import axios from 'axios';
import { parseUnits, formatUnits } from 'ethers/lib/utils';

interface TokenInfo {
    address: string;
    decimals: number;
}

interface ODOSQuoteRequestV3 {
    chainId: number;
    inputTokens: Array<{
        tokenAddress: string;
        amount: string;
    }>;
    outputTokens: Array<{
        tokenAddress: string;
        proportion: number;
    }>;
    gasPrice?: number;
    userAddr?: string;
    slippageLimitPercent?: number;
    sourceBlacklist?: string[];
    sourceWhitelist?: string[];
    poolBlacklist?: string[];
    pathVizImage?: boolean;
    disableRFQs?: boolean;
    referralCode?: number;
    compact?: boolean;
    likeAsset?: boolean;
    simple?: boolean;
}

interface ODOSQuoteResponseV3 {
    deprecated?: string;
    traceId?: string;
    inTokens: string[];
    outTokens: string[];
    inAmounts: string[];
    outAmounts: string[];
    gasEstimate: number;
    dataGasEstimate: number;
    gweiPerGas: number;
    gasEstimateValue: number;
    inValues: number[];
    outValues: number[];
    netOutValue: number;
    priceImpact: number;
    percentDiff: number;
    permit2Message?: any;
    permit2Hash?: string;
    partnerFeePercent: number;
    pathId: string;
    pathViz: any;
    pathVizImage: string;
    blockNumber: number;
}

export class ODOSReferenceVenue implements MarketVenue {
    private baseSymbol: string;
    private quoteSymbol: string;
    private chainId: number;
    private baseToken: TokenInfo;
    private quoteToken: TokenInfo;

    constructor(baseSymbol: string, quoteSymbol: string, chainId: number, baseToken: TokenInfo, quoteToken: TokenInfo) {
        this.baseSymbol = baseSymbol;
        this.quoteSymbol = quoteSymbol;
        this.chainId = chainId;
        this.baseToken = baseToken;
        this.quoteToken = quoteToken;
    }

    private async fetchODOSPriceData(fromToken: TokenInfo, toToken: TokenInfo, amount: string): Promise<ODOSQuoteResponseV3> {
        const requestBody: ODOSQuoteRequestV3 = {
            chainId: this.chainId,
            inputTokens: [{
                tokenAddress: fromToken.address,
                amount: parseUnits(amount, fromToken.decimals).toString()
            }],
            outputTokens: [{
                tokenAddress: toToken.address,
                proportion: 1
            }],
            userAddr: '0x0000000000000000000000000000000000000000', // Dummy address for quote
            slippageLimitPercent: 0.5, // 0.5% slippage for quote
            sourceBlacklist: [],
            sourceWhitelist: [],
            disableRFQs: true, // Disable RFQs for better reliability
            compact: true, // Use compact call data
            simple: false, // Get full path information
            referralCode: 0, // No referral code
            pathVizImage: false
        };

        try {
            const response = await axios.post('https://api.odos.xyz/sor/quote/v3', requestBody);
            return response.data;
        } catch (error: any) {
            console.error('Error fetching ODOS v3 quote:', error.response?.data || error.message);
            throw error;
        }
    }

    private calculatePrice(inAmount: string, outAmount: string, inDecimals: number, outDecimals: number, quoteToAsset: boolean): number {
        const formattedInAmount = parseFloat(formatUnits(inAmount, inDecimals));
        const formattedOutAmount = parseFloat(formatUnits(outAmount, outDecimals));
        return quoteToAsset ? 1 / (formattedOutAmount / formattedInAmount) : formattedOutAmount / formattedInAmount;
    }

    public async getBestBid(): Promise<number | null> {
        try {
            /// TODO: SMARTER SIZING REQUIRED HERE
            const data = await this.fetchODOSPriceData(this.baseToken, this.quoteToken, '1');
            return this.calculatePrice(data.inAmounts[0], data.outAmounts[0], this.baseToken.decimals, this.quoteToken.decimals, false);
        } catch (error) {
            console.error("Error getting best bid from ODOS v3:", error);
            return null;
        }
    }

    public async getBestAsk(): Promise<number | null> {
        try {
            /// TODO: SMARTER SIZING REQUIRED HERE
            const data = await this.fetchODOSPriceData(this.quoteToken, this.baseToken, '1');
            return this.calculatePrice(data.inAmounts[0], data.outAmounts[0], this.quoteToken.decimals, this.baseToken.decimals, true);
        } catch (error) {
            console.error("Error getting best ask from ODOS v3:", error);
            return null;
        }
    }

    public async getMidPointPrice(): Promise<number | null> {
        try {
            const [bestBid, bestAsk] = await Promise.all([this.getBestBid(), this.getBestAsk()]);

            if (bestBid === null || bestAsk === null) {
                throw new Error("Unable to calculate mid-point price due to missing data");
            }

            return (bestBid + bestAsk) / 2;
        } catch (error) {
            console.error("Error calculating mid-point price:", error);
            return null;
        }
    }

    async getBestBidAndAsk(): Promise<SimpleBook | null> {
        try {
            /// TODO: SMARTER SIZING REQUIRED HERE
            const [bidData, askData] = await Promise.all([
                this.fetchODOSPriceData(this.baseToken, this.quoteToken, '1'),
                this.fetchODOSPriceData(this.quoteToken, this.baseToken, '1')
            ]);

            const bidPrice = this.calculatePrice(bidData.inAmounts[0], bidData.outAmounts[0], this.baseToken.decimals, this.quoteToken.decimals, false);
            const askPrice = this.calculatePrice(askData.inAmounts[0], askData.outAmounts[0], this.quoteToken.decimals, this.baseToken.decimals, true);

            return {
                bids: [{ price: bidPrice, size: parseFloat(formatUnits(bidData.inAmounts[0], this.baseToken.decimals)) }],
                asks: [{ price: askPrice, size: parseFloat(formatUnits(askData.outAmounts[0], this.baseToken.decimals)) }]
            };
        } catch (error) {
            console.error("Error getting best bid and ask from ODOS v3:", error);
            return null;
        }
    }

    async getBestBidAndAskBasedOnSize(baseAmount: number, quoteAmount: number): Promise<SimpleBook | null> {
        try {
            const [bidData, askData] = await Promise.all([
                this.fetchODOSPriceData(this.baseToken, this.quoteToken, baseAmount.toString()),
                this.fetchODOSPriceData(this.quoteToken, this.baseToken, quoteAmount.toString())
            ]);

            const bidPrice = this.calculatePrice(bidData.inAmounts[0], bidData.outAmounts[0], this.baseToken.decimals, this.quoteToken.decimals, false);
            const askPrice = this.calculatePrice(askData.inAmounts[0], askData.outAmounts[0], this.quoteToken.decimals, this.baseToken.decimals, true);

            return {
                bids: [{ price: bidPrice, size: parseFloat(formatUnits(bidData.outAmounts[0], this.quoteToken.decimals)) / bidPrice }],
                asks: [{ price: askPrice, size: parseFloat(formatUnits(askData.outAmounts[0], this.baseToken.decimals)) }]
            };
        } catch (error) {
            console.error("Error getting best bid and ask based on size from ODOS v3:", error);
            return null;
        }
    }

    /**
     * Get additional ODOS v3 specific data like gas estimates and price impact
     * @param amount - Amount to get data for
     * @returns Promise with additional quote data
     */
    async getQuoteData(amount: string = '1'): Promise<{
        gasEstimate: number;
        gasEstimateValue: number;
        gweiPerGas: number;
        priceImpact: number;
        percentDiff: number;
        netOutValue: number;
    } | null> {
        try {
            const data = await this.fetchODOSPriceData(this.baseToken, this.quoteToken, amount);
            return {
                gasEstimate: data.gasEstimate,
                gasEstimateValue: data.gasEstimateValue,
                gweiPerGas: data.gweiPerGas,
                priceImpact: data.priceImpact,
                percentDiff: data.percentDiff,
                netOutValue: data.netOutValue
            };
        } catch (error) {
            console.error("Error getting quote data from ODOS v3:", error);
            return null;
        }
    }
}
