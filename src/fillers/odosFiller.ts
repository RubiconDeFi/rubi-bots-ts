import { ethers } from 'ethers';
import axios from 'axios';
import { parseUnits, formatUnits } from 'ethers/lib/utils';
import { getTokenInfoFromAddress } from '../utils/rubicon';

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
    pathVizImageConfig?: {
        linkColors?: string[];
        nodeColor?: string;
        nodeTextColor?: string;
        legendTextColor?: string;
        width?: number;
        height?: number;
    };
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

interface ODOSSwapRequest {
    userAddr: string;
    pathId: string;
    simulate?: boolean;
    disableRFQs?: boolean;
    sourceBlacklist?: string[];
}

interface ODOSSwapResponse {
    tx: {
        to: string;
        data: string;
        value: string;
        gas: number;
        gasPrice: string;
    };
    txValue: string;
    blockNumber: number;
}

export class ODOSFiller {
    private chainId: number;
    private provider: ethers.providers.Provider;
    private userAddress?: string;

    constructor(chainId: number, provider: ethers.providers.Provider, userAddress?: string) {
        this.chainId = chainId;
        this.provider = provider;
        this.userAddress = userAddress;
    }

    /**
     * Get a quote for swapping tokens through ODOS v3
     * @param fromTokenAddress - Address of the token to swap from
     * @param toTokenAddress - Address of the token to swap to
     * @param amount - Amount to swap (in human readable format, e.g., "1.5")
     * @returns Promise with quote information
     */
    async getQuote(
        fromTokenAddress: string,
        toTokenAddress: string,
        amount: string
    ): Promise<ODOSQuoteResponseV3> {
        try {
            const fromToken = getTokenInfoFromAddress(fromTokenAddress, this.chainId);
            const toToken = getTokenInfoFromAddress(toTokenAddress, this.chainId);

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
                userAddr: this.userAddress || '0x0000000000000000000000000000000000000000',
                slippageLimitPercent: 0.5, // 0.5% slippage for quote
                sourceBlacklist: [],
                sourceWhitelist: [],
                disableRFQs: true, // Disable RFQs for better reliability
                compact: true, // Use compact call data
                simple: false, // Get full path information
                referralCode: 0, // No referral code
                pathVizImage: false
            };

            const response = await axios.post('https://api.odos.xyz/sor/quote/v3', requestBody);
            return response.data;
        } catch (error: any) {
            console.error('Error getting ODOS v3 quote:', error.response?.data || error.message);
            throw new Error(`Failed to get ODOS v3 quote: ${error.message}`);
        }
    }

    /**
     * Get the price for swapping tokens through ODOS v3
     * @param fromTokenAddress - Address of the token to swap from
     * @param toTokenAddress - Address of the token to swap to
     * @param amount - Amount to swap (in human readable format)
     * @returns Promise with the price ratio
     */
    async getTokenPrice(
        fromTokenAddress: string,
        toTokenAddress: string,
        amount: string = "1"
    ): Promise<number> {
        try {
            const quote = await this.getQuote(fromTokenAddress, toTokenAddress, amount);
            const fromToken = getTokenInfoFromAddress(fromTokenAddress, this.chainId);
            const toToken = getTokenInfoFromAddress(toTokenAddress, this.chainId);

            const inAmount = parseFloat(formatUnits(quote.inAmounts[0], fromToken.decimals));
            const outAmount = parseFloat(formatUnits(quote.outAmounts[0], toToken.decimals));

            return outAmount / inAmount;
        } catch (error) {
            console.error('Error getting token price:', error);
            throw error;
        }
    }

    /**
     * Get the best bid and ask prices for a token pair
     * @param baseTokenAddress - Address of the base token
     * @param quoteTokenAddress - Address of the quote token
     * @param amount - Amount to use for price calculation
     * @returns Promise with bid and ask prices
     */
    async getBestBidAndAsk(
        baseTokenAddress: string,
        quoteTokenAddress: string,
        amount: string = "1"
    ): Promise<{ bid: number; ask: number }> {
        try {
            const [bidQuote, askQuote] = await Promise.all([
                this.getQuote(baseTokenAddress, quoteTokenAddress, amount),
                this.getQuote(quoteTokenAddress, baseTokenAddress, amount)
            ]);

            const baseToken = getTokenInfoFromAddress(baseTokenAddress, this.chainId);
            const quoteToken = getTokenInfoFromAddress(quoteTokenAddress, this.chainId);

            const bidPrice = parseFloat(formatUnits(bidQuote.outAmounts[0], quoteToken.decimals)) / 
                           parseFloat(formatUnits(bidQuote.inAmounts[0], baseToken.decimals));

            const askPrice = parseFloat(formatUnits(askQuote.outAmounts[0], baseToken.decimals)) / 
                           parseFloat(formatUnits(askQuote.inAmounts[0], quoteToken.decimals));

            return { bid: bidPrice, ask: askPrice };
        } catch (error) {
            console.error('Error getting best bid and ask:', error);
            throw error;
        }
    }

    /**
     * Get the mid-point price for a token pair
     * @param baseTokenAddress - Address of the base token
     * @param quoteTokenAddress - Address of the quote token
     * @param amount - Amount to use for price calculation
     * @returns Promise with the mid-point price
     */
    async getMidPointPrice(
        baseTokenAddress: string,
        quoteTokenAddress: string,
        amount: string = "1"
    ): Promise<number> {
        try {
            const { bid, ask } = await this.getBestBidAndAsk(baseTokenAddress, quoteTokenAddress, amount);
            return (bid + ask) / 2;
        } catch (error) {
            console.error('Error getting mid-point price:', error);
            throw error;
        }
    }

    /**
     * Get a swap transaction for executing a token swap
     * @param fromTokenAddress - Address of the token to swap from
     * @param toTokenAddress - Address of the token to swap to
     * @param amount - Amount to swap (in human readable format)
     * @param userAddress - Address of the user executing the swap
     * @returns Promise with swap transaction data
     */
    async getSwapTransaction(
        fromTokenAddress: string,
        toTokenAddress: string,
        amount: string,
        userAddress: string
    ): Promise<ODOSSwapResponse> {
        try {
            // First get a quote to get the pathId
            const quote = await this.getQuote(fromTokenAddress, toTokenAddress, amount);
            
            if (!quote.pathId) {
                throw new Error('No path ID returned from quote');
            }

            const swapRequestBody: ODOSSwapRequest = {
                userAddr: userAddress,
                pathId: quote.pathId,
                simulate: false,
                disableRFQs: true
            };

            const response = await axios.post('https://api.odos.xyz/sor/assemble', swapRequestBody);
            return response.data;
        } catch (error: any) {
            console.error('Error getting swap transaction:', error.response?.data || error.message);
            throw new Error(`Failed to get swap transaction: ${error.message}`);
        }
    }

    /**
     * Get price impact for a swap
     * @param fromTokenAddress - Address of the token to swap from
     * @param toTokenAddress - Address of the token to swap to
     * @param amount - Amount to swap (in human readable format)
     * @returns Promise with price impact percentage
     */
    async getPriceImpact(
        fromTokenAddress: string,
        toTokenAddress: string,
        amount: string
    ): Promise<number> {
        try {
            const quote = await this.getQuote(fromTokenAddress, toTokenAddress, amount);
            return quote.priceImpact;
        } catch (error) {
            console.error('Error getting price impact:', error);
            throw error;
        }
    }

    /**
     * Get gas estimate for a swap
     * @param fromTokenAddress - Address of the token to swap from
     * @param toTokenAddress - Address of the token to swap to
     * @param amount - Amount to swap (in human readable format)
     * @returns Promise with gas estimate
     */
    async getGasEstimate(
        fromTokenAddress: string,
        toTokenAddress: string,
        amount: string
    ): Promise<number> {
        try {
            const quote = await this.getQuote(fromTokenAddress, toTokenAddress, amount);
            return quote.gasEstimate;
        } catch (error) {
            console.error('Error getting gas estimate:', error);
            throw error;
        }
    }

    /**
     * Get gas price in gwei
     * @param fromTokenAddress - Address of the token to swap from
     * @param toTokenAddress - Address of the token to swap to
     * @param amount - Amount to swap (in human readable format)
     * @returns Promise with gas price in gwei
     */
    async getGasPrice(
        fromTokenAddress: string,
        toTokenAddress: string,
        amount: string
    ): Promise<number> {
        try {
            const quote = await this.getQuote(fromTokenAddress, toTokenAddress, amount);
            return quote.gweiPerGas;
        } catch (error) {
            console.error('Error getting gas price:', error);
            throw error;
        }
    }

    /**
     * Get USD value of gas estimate
     * @param fromTokenAddress - Address of the token to swap from
     * @param toTokenAddress - Address of the token to swap to
     * @param amount - Amount to swap (in human readable format)
     * @returns Promise with USD value of gas estimate
     */
    async getGasEstimateValue(
        fromTokenAddress: string,
        toTokenAddress: string,
        amount: string
    ): Promise<number> {
        try {
            const quote = await this.getQuote(fromTokenAddress, toTokenAddress, amount);
            return quote.gasEstimateValue;
        } catch (error) {
            console.error('Error getting gas estimate value:', error);
            throw error;
        }
    }

    /**
     * Get percent difference between input and output values
     * @param fromTokenAddress - Address of the token to swap from
     * @param toTokenAddress - Address of the token to swap to
     * @param amount - Amount to swap (in human readable format)
     * @returns Promise with percent difference
     */
    async getPercentDiff(
        fromTokenAddress: string,
        toTokenAddress: string,
        amount: string
    ): Promise<number> {
        try {
            const quote = await this.getQuote(fromTokenAddress, toTokenAddress, amount);
            return quote.percentDiff;
        } catch (error) {
            console.error('Error getting percent diff:', error);
            throw error;
        }
    }

    /**
     * Get supported tokens for a specific chain
     * @param chainId - Chain ID to get tokens for
     * @returns Promise with list of supported tokens
     */
    async getSupportedTokens(chainId?: number): Promise<any[]> {
        try {
            const targetChainId = chainId || this.chainId;
            const response = await axios.get(`https://api.odos.xyz/info/tokens/${targetChainId}`);
            return response.data;
        } catch (error: any) {
            console.error('Error getting supported tokens:', error.response?.data || error.message);
            throw new Error(`Failed to get supported tokens: ${error.message}`);
        }
    }

    /**
     * Get supported chains
     * @returns Promise with list of supported chains
     */
    async getSupportedChains(): Promise<any[]> {
        try {
            const response = await axios.get('https://api.odos.xyz/info/chains');
            return response.data;
        } catch (error: any) {
            console.error('Error getting supported chains:', error.response?.data || error.message);
            throw new Error(`Failed to get supported chains: ${error.message}`);
        }
    }

    /**
     * Get liquidity sources for a specific chain
     * @param chainId - Chain ID to get liquidity sources for
     * @returns Promise with list of liquidity sources
     */
    async getLiquiditySources(chainId?: number): Promise<any[]> {
        try {
            const targetChainId = chainId || this.chainId;
            const response = await axios.get(`https://api.odos.xyz/info/liquidity-sources/${targetChainId}`);
            return response.data;
        } catch (error: any) {
            console.error('Error getting liquidity sources:', error.response?.data || error.message);
            throw new Error(`Failed to get liquidity sources: ${error.message}`);
        }
    }

    /**
     * Get token information including decimals and symbol
     * @param tokenAddress - Address of the token
     * @returns Token information
     */
    getTokenInfo(tokenAddress: string) {
        return getTokenInfoFromAddress(tokenAddress, this.chainId);
    }

    /**
     * Format amount to token decimals
     * @param amount - Amount in human readable format
     * @param tokenAddress - Address of the token
     * @returns Formatted amount string
     */
    formatAmount(amount: string, tokenAddress: string): string {
        const token = getTokenInfoFromAddress(tokenAddress, this.chainId);
        return parseUnits(amount, token.decimals).toString();
    }

    /**
     * Parse amount from token decimals to human readable format
     * @param amount - Amount in wei/smallest unit
     * @param tokenAddress - Address of the token
     * @returns Human readable amount string
     */
    parseAmount(amount: string, tokenAddress: string): string {
        const token = getTokenInfoFromAddress(tokenAddress, this.chainId);
        return formatUnits(amount, token.decimals);
    }
}
