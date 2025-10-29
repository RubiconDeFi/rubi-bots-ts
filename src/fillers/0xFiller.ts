import { ethers } from 'ethers';
import { createClientV2 } from '@0x/swap-ts-sdk';
import { parseUnits, formatUnits } from 'ethers/lib/utils';
import { getTokenInfoFromAddress } from '../utils/rubicon';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface ZeroXQuote {
    buyAmount: string;
    sellAmount: string;
    allowanceTarget: string;
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice: string;
    buyToken: string;
    sellToken: string;
    estimatedGas: string;
}

interface ZeroXSwapTransaction {
    to: string;
    data: string;
    value: string;
    gas?: string;
    gasPrice?: string;
    allowanceTarget: string;
}

export class ZeroXFiller {
    private chainId: number;
    private provider: ethers.providers.Provider;
    private userAddress?: string;
    private client: ReturnType<typeof createClientV2>;
    private apiKey: string;

    constructor(
        chainId: number, 
        provider: ethers.providers.Provider, 
        apiKey?: string,
        userAddress?: string
    ) {
        this.chainId = chainId;
        this.provider = provider;
        this.userAddress = userAddress;
        
        // Get API key from parameter or environment variable
        this.apiKey = apiKey || process.env.ZEROX_API_KEY || '';
        
        if (!this.apiKey) {
            throw new Error('0x API key required. Set ZEROX_API_KEY in .env or pass as constructor parameter');
        }
        
        // Initialize 0x API client
        this.client = createClientV2({
            apiKey: this.apiKey,
        });
    }

    /**
     * Get a quote for swapping tokens through 0x API v2 (Permit2 flow)
     * @param fromTokenAddress - Address of the token to swap from
     * @param toTokenAddress - Address of the token to swap to
     * @param amount - Amount to swap (in human readable format, e.g., "1.5")
     * @param slippagePercentage - Slippage tolerance (default: 0.5%)
     * @returns Promise with quote information including swap calldata
     */
    async getQuote(
        fromTokenAddress: string,
        toTokenAddress: string,
        amount: string,
        slippagePercentage: number = 0.5
    ): Promise<ZeroXQuote> {
        try {
            const fromToken = getTokenInfoFromAddress(fromTokenAddress, this.chainId);
            const sellAmount = parseUnits(amount, fromToken.decimals).toString();

            // Get quote using Permit2 flow (recommended for contract interactions)
            const quote = await this.client.swap.permit2.getQuote.query({
                chainId: this.chainId,
                sellToken: fromTokenAddress.toLowerCase(),
                buyToken: toTokenAddress.toLowerCase(),
                sellAmount: sellAmount,
                slippagePercentage: slippagePercentage,
                taker: this.userAddress || '0x0000000000000000000000000000000000000000',
            });

            return {
                buyAmount: quote.buyAmount,
                sellAmount: quote.sellAmount,
                allowanceTarget: quote.allowanceTarget,
                to: quote.to,
                data: quote.data,
                value: quote.value || '0',
                gas: quote.estimatedGas?.toString() || '0',
                gasPrice: quote.gasPrice || '0',
                buyToken: toTokenAddress,
                sellToken: fromTokenAddress,
                estimatedGas: quote.estimatedGas?.toString() || '0',
            };
        } catch (error: any) {
            console.error('Error getting 0x quote:', error);
            throw new Error(`Failed to get 0x quote: ${error.message || 'Unknown error'}`);
        }
    }

    /**
     * Get a swap transaction for executing a token swap via 0x
     * @param fromTokenAddress - Address of the token to swap from
     * @param toTokenAddress - Address of the token to swap to
     * @param amount - Amount to swap (in human readable format)
     * @param slippagePercentage - Slippage tolerance (default: 0.5%)
     * @returns Promise with swap transaction data ready for execution
     */
    async getSwapTransaction(
        fromTokenAddress: string,
        toTokenAddress: string,
        amount: string,
        slippagePercentage: number = 0.5
    ): Promise<ZeroXSwapTransaction> {
        try {
            const quote = await this.getQuote(
                fromTokenAddress,
                toTokenAddress,
                amount,
                slippagePercentage
            );

            return {
                to: quote.to,
                data: quote.data,
                value: quote.value,
                gas: quote.gas,
                gasPrice: quote.gasPrice,
                allowanceTarget: quote.allowanceTarget,
            };
        } catch (error: any) {
            console.error('Error getting 0x swap transaction:', error);
            throw new Error(`Failed to get 0x swap transaction: ${error.message}`);
        }
    }

    /**
     * Get the price for swapping tokens through 0x
     * @param fromTokenAddress - Address of the token to swap from
     * @param toTokenAddress - Address of the token to swap to
     * @param amount - Amount to swap (in human readable format, default: "1")
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

            const inAmount = parseFloat(formatUnits(quote.sellAmount, fromToken.decimals));
            const outAmount = parseFloat(formatUnits(quote.buyAmount, toToken.decimals));

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

            const bidPrice = parseFloat(formatUnits(bidQuote.buyAmount, quoteToken.decimals)) / 
                           parseFloat(formatUnits(bidQuote.sellAmount, baseToken.decimals));

            const askPrice = parseFloat(formatUnits(askQuote.buyAmount, baseToken.decimals)) / 
                           parseFloat(formatUnits(askQuote.sellAmount, quoteToken.decimals));

            return { bid: bidPrice, ask: askPrice };
        } catch (error) {
            console.error('Error getting best bid and ask:', error);
            throw error;
        }
    }

    /**
     * Get a quote with buyAmount instead of sellAmount (for filling orders where we know output)
     * @param fromTokenAddress - Address of the token to swap from
     * @param toTokenAddress - Address of the token to swap to
     * @param buyAmount - Amount we want to receive (in human readable format)
     * @param slippagePercentage - Slippage tolerance (default: 0.5%)
     * @returns Promise with quote information
     */
    async getQuoteForBuyAmount(
        fromTokenAddress: string,
        toTokenAddress: string,
        buyAmount: string,
        slippagePercentage: number = 0.5
    ): Promise<ZeroXQuote> {
        try {
            const toToken = getTokenInfoFromAddress(toTokenAddress, this.chainId);
            const buyAmountWei = parseUnits(buyAmount, toToken.decimals).toString();

            const quote = await this.client.swap.permit2.getQuote.query({
                chainId: this.chainId,
                sellToken: fromTokenAddress.toLowerCase(),
                buyToken: toTokenAddress.toLowerCase(),
                buyAmount: buyAmountWei,
                slippagePercentage: slippagePercentage,
                taker: this.userAddress || '0x0000000000000000000000000000000000000000',
            });

            return {
                buyAmount: quote.buyAmount,
                sellAmount: quote.sellAmount,
                allowanceTarget: quote.allowanceTarget,
                to: quote.to,
                data: quote.data,
                value: quote.value || '0',
                gas: quote.estimatedGas?.toString() || '0',
                gasPrice: quote.gasPrice || '0',
                buyToken: toTokenAddress,
                sellToken: fromTokenAddress,
                estimatedGas: quote.estimatedGas?.toString() || '0',
            };
        } catch (error: any) {
            console.error('Error getting 0x quote for buy amount:', error);
            throw new Error(`Failed to get 0x quote: ${error.message || 'Unknown error'}`);
        }
    }

    /**
     * Get the allowance target address for a given chain
     * This is the address that needs token approval for 0x swaps
     * @returns The allowance target address (e.g., AllowanceHolder contract)
     */
    getAllowanceTarget(): string {
        // This will be populated from the quote response
        // For now, return empty - will be set from actual quote
        return '';
    }

    /**
     * Format quote response for human-readable display
     */
    formatQuote(quote: ZeroXQuote): string {
        const fromToken = getTokenInfoFromAddress(quote.sellToken, this.chainId);
        const toToken = getTokenInfoFromAddress(quote.buyToken, this.chainId);

        const sellAmount = parseFloat(formatUnits(quote.sellAmount, fromToken.decimals));
        const buyAmount = parseFloat(formatUnits(quote.buyAmount, toToken.decimals));
        const price = buyAmount / sellAmount;

        return `
0x Quote:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sell: ${sellAmount.toFixed(6)} ${fromToken.symbol}
Buy:  ${buyAmount.toFixed(6)} ${toToken.symbol}
Price: ${price.toFixed(8)} ${toToken.symbol}/${fromToken.symbol}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Swap Target: ${quote.to}
Allowance Target: ${quote.allowanceTarget}
Estimated Gas: ${quote.estimatedGas}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `.trim();
    }
}

