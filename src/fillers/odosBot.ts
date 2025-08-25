import { ethers } from 'ethers';
import axios from 'axios';
import { parseUnits, formatUnits } from 'ethers/lib/utils';
import { ODOSFiller } from './odosFiller';
import { getTokenInfoFromAddress } from '../utils/rubicon';
import { ORDER_STATUS } from '../types/rubicon';
import { DutchOrder } from '@rubicondefi/gladius-sdk';
import { tokenList } from '../config/tokens';

interface GladiusOrder {
    orderHash: string;
    encodedOrder: string;
    signature: string;
    orderStatus: string;
    chainId: number;
    type: string;
    price: string;
    fillThreshold: string;
    outputs: Array<{
        recipient: string;
        endAmount: string;
        token: string;
        startAmount: string;
    }>;
    input: {
        endAmount: string;
        token: string;
        startAmount: string;
    };
    createdAt: number;
}

interface ParsedOrder {
    hash: string;
    status: string;
    type: 'BID' | 'ASK';
    baseToken: string;
    quoteToken: string;
    baseAmount: number;
    quoteAmount: number;
    price: number;
    owner: string;
    nonce: string;
    deadline: number;
    timeRemaining: string;
    isExpired: boolean;
    isActive: boolean;
    // Dutch auction decay fields
    isDutchOrder: boolean;
    startBaseAmount: number;
    endBaseAmount: number;
    startQuoteAmount: number;
    endQuoteAmount: number;
    decayStartTime: number;
    decayEndTime: number;
    currentBaseAmount: number;
    currentQuoteAmount: number;
    currentPrice: number;
}

interface ArbitrageOpportunity {
    gladiusOrder: ParsedOrder;
    odosQuote: any;
    odosPrice: number;
    gladiusPrice: number;
    priceDifference: number;
    priceDifferencePercent: number;
    potentialProfit: number;
    canFill: boolean;
    fillAmount: number;
    surplus: number;
    gasEstimate: number;
    gasCostUSD: number;
    netProfit: number;
}

export class ODOSBot {
    private chainId: number;
    private provider: ethers.providers.Provider;
    private odosFiller: ODOSFiller;
    private gladiusUrl: string;
    private pollingInterval: number;
    private isPolling: boolean = false;
    private lastOrderUpdate: number = 0;
    private outstandingOrders: ParsedOrder[] = [];
    private arbitrageOpportunities: ArbitrageOpportunity[] = [];

    constructor(
        chainId: number, 
        provider: ethers.providers.Provider, 
        pollingInterval: number = 10000 // 10 seconds default
    ) {
        this.chainId = chainId;
        this.provider = provider;
        this.odosFiller = new ODOSFiller(chainId, provider);
        this.gladiusUrl = "https://gladius.rubicon.finance";
        this.pollingInterval = pollingInterval;
    }

    /**
     * Start monitoring Gladius orders continuously
     */
    startMonitoring(): void {
        if (this.isPolling) {
            console.log('🔄 ODOS Bot is already monitoring orders');
            return;
        }

        console.log(`🚀 Starting ODOS Bot monitoring on chain ${this.chainId}`);
        console.log(`📡 Polling Gladius orders every ${this.pollingInterval / 1000} seconds`);
        
        this.isPolling = true;
        this.pollOrders();
        
        // Set up continuous polling
        setInterval(() => {
            if (this.isPolling) {
                this.pollOrders();
            }
        }, this.pollingInterval);
    }

    /**
     * Stop monitoring Gladius orders
     */
    stopMonitoring(): void {
        console.log('⏹️ Stopping ODOS Bot monitoring');
        this.isPolling = false;
    }

    /**
     * Poll for new orders from Gladius
     */
    private async pollOrders(): Promise<void> {
        try {
            const orders = await this.fetchAllGladiusOrders();
            const parsedOrders = await this.parseOrders(orders);
            
            // Update outstanding orders
            this.outstandingOrders = parsedOrders.filter(order => order.isActive);
            this.lastOrderUpdate = Date.now();
            
            console.log(`📊 Updated order book: ${this.outstandingOrders.length} active orders`);
            
        } catch (error) {
            console.error('❌ Error polling Gladius orders:', error);
        }
    }

    /**
     * Fetch all orders from Gladius API
     */
    private async fetchAllGladiusOrders(): Promise<GladiusOrder[]> {
        try {
            console.log(`🔍 Fetching Gladius orders with chainId + orderStatus open...`);
            
            const response = await axios.get(`${this.gladiusUrl}/dutch-auction/orders`, {
                params: { 
                    chainId: this.chainId,
                    orderStatus: 'open'
                }
            });
            
            console.log(`✅ Success! Found ${response.data?.orders?.length || 0} orders`);
            return this.processOrdersResponse(response.data);
            
        } catch (error: any) {
            console.error('Error fetching Gladius orders:', error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Process the orders response from any of the API attempts
     */
    private processOrdersResponse(data: any): GladiusOrder[] {
        console.log(`🔍 Processing orders response...`);
        console.log(`📊 Response data structure:`, Object.keys(data || {}));
        
        if (data && data.orders) {
            const allOrders = data.orders;
            console.log(`📋 Total orders in response: ${allOrders.length}`);
            
            // Filter by chainId and status after fetching
            const filteredOrders = allOrders.filter((order: any) => {
                const orderChainId = order.chainId || order.chain_id;
                const orderStatus = order.orderStatus || order.status;
                
                console.log(`🔍 Order ${order.orderHash?.slice(0, 8)}...: chainId=${orderChainId}, status=${orderStatus}`);
                
                return orderChainId === this.chainId && orderStatus === 'open';
            });
            
            console.log(`✅ Filtered orders for chain ${this.chainId}: ${filteredOrders.length}`);
            return filteredOrders;
        }
        
        console.log(`❌ No orders found in response data`);
        return [];
    }

    /**
     * Parse raw Gladius orders into human-readable format
     */
    private async parseOrders(orders: GladiusOrder[]): Promise<ParsedOrder[]> {
        const parsedOrders: ParsedOrder[] = [];

        for (const order of orders) {
            try {
                // Get token info from the actual order data
                console.log(`🔍 Parsing order ${order.orderHash.slice(0, 8)}...`);
                console.log(`  📥 Input token: ${order.input.token} (chainId: ${this.chainId})`);
                console.log(`  📤 Output token: ${order.outputs[0].token} (chainId: ${this.chainId})`);
                
                // Try to get token info with case-insensitive comparison
                let inputTokenInfo, outputTokenInfo;
                
                try {
                    inputTokenInfo = getTokenInfoFromAddress(order.input.token, this.chainId);
                    console.log(`  ✅ Input token found: ${inputTokenInfo.symbol} (${inputTokenInfo.address})`);
                } catch (error) {
                    console.error(`  ❌ Input token not found: ${order.input.token}`);
                    // console.error(`  🔍 Available tokens on chain ${this.chainId}:`, 
                    //     tokenList.tokens
                    //         .filter(t => t.chainId === this.chainId)
                    //         .map(t => `${t.symbol}:${t.address}`)
                    // );
                    continue;
                }
                
                try {
                    outputTokenInfo = getTokenInfoFromAddress(order.outputs[0].token, this.chainId);
                    console.log(`  ✅ Output token found: ${outputTokenInfo.symbol} (${outputTokenInfo.address})`);
                } catch (error) {
                    console.error(`  ❌ Output token not found: ${order.outputs[0].token}`);
                    // console.error(`  🔍 Available tokens on chain ${this.chainId}:`, 
                    //     tokenList.tokens
                    //         .filter(t => t.chainId === this.chainId)
                    //         .map(t => `${t.symbol}:${t.address}`)
                    // );
                    continue;
                }
                
                // Parse start and end amounts using actual token decimals
                const inputStartAmount = parseFloat(formatUnits(order.input.startAmount, inputTokenInfo.decimals));
                const inputEndAmount = parseFloat(formatUnits(order.input.endAmount, inputTokenInfo.decimals));
                const outputStartAmount = parseFloat(formatUnits(order.outputs[0].startAmount, outputTokenInfo.decimals));
                const outputEndAmount = parseFloat(formatUnits(order.outputs[0].endAmount, outputTokenInfo.decimals));
                
                // Determine order type based on token addresses
                // If input token is the base token (like RUBI), it's an ASK (selling)
                // If output token is the base token, it's a BID (buying)
                const isBaseTokenInput = inputTokenInfo.symbol === 'RUBI' || inputTokenInfo.symbol === 'WETH' || inputTokenInfo.symbol === 'ETH';
                const orderType: 'BID' | 'ASK' = isBaseTokenInput ? 'ASK' : 'BID';
                
                // Check if this is a Dutch auction order (different start/end amounts)
                const isDutchOrder = (inputStartAmount !== inputEndAmount) || (outputStartAmount !== outputEndAmount);
                
                // Calculate decay timing (default to 1 hour if not specified)
                const now = Math.floor(Date.now() / 1000);
                const decayStartTime = order.createdAt;
                const decayEndTime = order.createdAt + 3600; // Default 1 hour
                const deadline = decayEndTime;
                
                // Calculate current amounts based on Dutch decay
                let currentInputAmount: number;
                let currentOutputAmount: number;
                let currentPrice: number;
                
                if (isDutchOrder) {
                    // Linear interpolation between start and end amounts based on current time
                    const timeProgress = Math.min(1, Math.max(0, (now - decayStartTime) / (decayEndTime - decayStartTime)));
                    
                    currentInputAmount = inputStartAmount + (inputEndAmount - inputStartAmount) * timeProgress;
                    currentOutputAmount = outputStartAmount + (outputEndAmount - outputStartAmount) * timeProgress;
                    
                    console.log(`  🕐 Dutch auction detected! Time progress: ${(timeProgress * 100).toFixed(1)}%`);
                    console.log(`  📊 Input: ${inputStartAmount.toFixed(6)} → ${currentInputAmount.toFixed(6)} → ${inputEndAmount.toFixed(6)}`);
                    console.log(`  📊 Output: ${outputStartAmount.toFixed(6)} → ${currentOutputAmount.toFixed(6)} → ${outputEndAmount.toFixed(6)}`);
                } else {
                    // Static order - use end amounts
                    currentInputAmount = inputEndAmount;
                    currentOutputAmount = outputEndAmount;
                    console.log(`  📊 Static order - no decay`);
                }
                
                // Calculate current price based on order type
                if (orderType === 'BID') {
                    // BID: buying base with quote, price = quote amount / base amount
                    currentPrice = currentOutputAmount / currentInputAmount;
                } else {
                    // ASK: selling base for quote, price = quote amount / base amount
                    currentPrice = currentOutputAmount / currentInputAmount;
                }
                
                // Check if order is expired
                const isExpired = deadline < now;
                const isActive = order.orderStatus === ORDER_STATUS.OPEN && !isExpired;
                
                // Calculate time remaining
                const timeRemaining = this.calculateTimeRemaining(deadline);
                
                // Determine base/quote amounts for the current state
                const currentBaseAmount = isBaseTokenInput ? currentInputAmount : currentOutputAmount;
                const currentQuoteAmount = isBaseTokenInput ? currentOutputAmount : currentInputAmount;
                
                const parsedOrder: ParsedOrder = {
                    hash: order.orderHash,
                    status: order.orderStatus,
                    type: orderType,
                    baseToken: isBaseTokenInput ? inputTokenInfo.symbol : outputTokenInfo.symbol,
                    quoteToken: isBaseTokenInput ? outputTokenInfo.symbol : inputTokenInfo.symbol,
                    baseAmount: currentBaseAmount,
                    quoteAmount: currentQuoteAmount,
                    price: currentPrice,
                    owner: order.outputs[0].recipient,
                    nonce: order.orderHash.slice(0, 8), // Use hash prefix as nonce for now
                    deadline,
                    timeRemaining,
                    isExpired,
                    isActive,
                    // Dutch auction fields
                    isDutchOrder,
                    startBaseAmount: isBaseTokenInput ? inputStartAmount : outputStartAmount,
                    endBaseAmount: isBaseTokenInput ? inputEndAmount : outputEndAmount,
                    startQuoteAmount: isBaseTokenInput ? outputStartAmount : inputStartAmount,
                    endQuoteAmount: isBaseTokenInput ? outputEndAmount : inputEndAmount,
                    decayStartTime,
                    decayEndTime,
                    currentBaseAmount,
                    currentQuoteAmount,
                    currentPrice
                };
                
                console.log(`✅ Parsed order: ${orderType} ${currentBaseAmount.toFixed(6)} ${parsedOrder.baseToken} @ ${currentPrice.toFixed(6)} ${parsedOrder.quoteToken}${isDutchOrder ? ' (Dutch)' : ''}`);
                parsedOrders.push(parsedOrder);
                
            } catch (error) {
                console.error(`Error parsing order ${order.orderHash}:`, error);
                continue;
            }
        }
        
        return parsedOrders;
    }

    /**
     * Calculate human-readable time remaining until deadline
     */
    private calculateTimeRemaining(deadline: number): string {
        const now = Math.floor(Date.now() / 1000);
        const remaining = deadline - now;
        
        if (remaining <= 0) {
            return 'EXPIRED';
        }
        
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const seconds = remaining % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Find arbitrage opportunities by comparing Gladius orders with ODOS quotes
     * This is the core method that queries ODOS for reverse trades
     */
    async findArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
        console.log(`🔍 Searching for arbitrage opportunities across ${this.outstandingOrders.length} Gladius orders...`);
        
        const opportunities: ArbitrageOpportunity[] = [];
        
        for (const gladiusOrder of this.outstandingOrders) {
            try {
                // Query ODOS for the REVERSE trade
                // If Gladius order is buying RUBI with DAI, query ODOS for selling RUBI to get DAI
                const odosQuote = await this.getODOSReverseQuote(gladiusOrder);
                
                if (odosQuote) {
                    const opportunity = this.analyzeArbitrageOpportunity(gladiusOrder, odosQuote);
                    if (opportunity.canFill) {
                        opportunities.push(opportunity);
                    }
                }
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`Error analyzing order ${gladiusOrder.hash}:`, error);
                continue;
            }
        }
        
        this.arbitrageOpportunities = opportunities;
        console.log(`✅ Found ${opportunities.length} arbitrage opportunities!`);
        
        return opportunities;
    }

    /**
     * Get ODOS quote for the reverse trade of a Gladius order
     */
    private async getODOSReverseQuote(gladiusOrder: ParsedOrder): Promise<any> {
        try {
            console.log(`🔍 Getting ODOS reverse quote for order ${gladiusOrder.hash.slice(0, 8)}...`);
            console.log(`  📊 Order type: ${gladiusOrder.type}`);
            console.log(`  💰 Base token: ${gladiusOrder.baseToken}`);
            console.log(`  💱 Quote token: ${gladiusOrder.quoteToken}`);
            console.log(`  📦 Base amount: ${gladiusOrder.baseAmount}`);
            console.log(`  💸 Quote amount: ${gladiusOrder.quoteAmount}`);
            
            // For a Gladius BID (buying base with quote), we want to sell base to get quote on ODOS
            // For a Gladius ASK (selling base for quote), we want to buy base with quote on ODOS
            
            let fromToken: string;
            let toToken: string;
            let amount: string;
            
            if (gladiusOrder.type === 'BID') {
                // Gladius is buying base with quote, so we want to sell base to get quote on ODOS
                fromToken = gladiusOrder.baseToken;
                toToken = gladiusOrder.quoteToken;
                amount = gladiusOrder.baseAmount.toString();
                console.log(`  🔄 BID: Selling ${amount} ${fromToken} to get ${toToken} on ODOS`);
            } else {
                // Gladius is selling base for quote, so we want to sell base to get quote on ODOS (REVERSE)
                // We sell the base amount on ODOS to see how much quote we get
                fromToken = gladiusOrder.baseToken;
                toToken = gladiusOrder.quoteToken;
                amount = gladiusOrder.baseAmount.toString();
                console.log(`  🔄 ASK: Selling ${amount} ${fromToken} to get ${toToken} on ODOS (reverse trade)`);
            }
            
            console.log(`  🔍 Looking up token info for: ${fromToken} and ${toToken}`);
            
            // Get token addresses - we need to use the actual addresses, not symbols!
            console.log(`  🔍 Looking up token info for symbols: ${fromToken} and ${toToken}`);
            
            // Find the actual token addresses from our parsed order
            let fromTokenAddress: string, toTokenAddress: string;
            
            if (gladiusOrder.type === 'BID') {
                // For BID: baseToken is RUBI, quoteToken is DAI
                // We want to sell RUBI to get DAI on ODOS
                fromTokenAddress = '0xb3836098d1e94EC651D74D053d4a0813316B2a2f'; // RUBI address
                toTokenAddress = '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'; // DAI address
            } else {
                // For ASK: baseToken is RUBI, quoteToken is DAI  
                // We want to sell RUBI to get DAI on ODOS (same as BID for this pair)
                fromTokenAddress = '0xb3836098d1e94EC651D74D053d4a0813316B2a2f'; // RUBI address
                toTokenAddress = '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'; // DAI address
            }
            
            console.log(`  🎯 Using addresses: ${fromTokenAddress} -> ${toTokenAddress}`);
            
            // Validate these addresses exist in our token list
            const fromTokenInfo = getTokenInfoFromAddress(fromTokenAddress, this.chainId);
            const toTokenInfo = getTokenInfoFromAddress(toTokenAddress, this.chainId);
            
            console.log(`  ✅ From token: ${fromTokenInfo.symbol} (${fromTokenInfo.address})`);
            console.log(`  ✅ To token: ${toTokenInfo.symbol} (${toTokenInfo.address})`);
            console.log(`  💰 Amount: ${amount}`);
            
            // Double-check these tokens exist in our list
            const availableTokens = tokenList.tokens.filter(t => t.chainId === this.chainId);
            // console.log(`  🔍 Available tokens on chain ${this.chainId}:`, 
            //     availableTokens.map(t => `${t.symbol}:${t.address}`)
            // );
            
            // Query ODOS for the reverse trade
            console.log(`  🚀 Querying ODOS for quote...`);
            const quote = await this.odosFiller.getQuote(
                fromTokenInfo.address,
                toTokenInfo.address,
                amount
            );
            
            console.log(`  ✅ ODOS quote received!`);
            return quote;
            
        } catch (error) {
            console.error(`❌ Error getting ODOS reverse quote for order ${gladiusOrder.hash}:`, error);
            return null;
        }
    }

    /**
     * Analyze if there's an arbitrage opportunity between Gladius and ODOS
     * Uses absolute input/output amounts for certainty, not rate math
     */
    private analyzeArbitrageOpportunity(gladiusOrder: ParsedOrder, odosQuote: any): ArbitrageOpportunity {
        console.log(`🔍 Analyzing arbitrage for order ${gladiusOrder.hash.slice(0, 8)}...`);
        
        // Get token info for proper decimal handling - use hardcoded addresses
        let baseTokenInfo, quoteTokenInfo;
        
        if (gladiusOrder.baseToken === 'RUBI') {
            baseTokenInfo = getTokenInfoFromAddress('0xb3836098d1e94EC651D74D053d4a0813316B2a2f', this.chainId);
        } else if (gladiusOrder.baseToken === 'DAI') {
            baseTokenInfo = getTokenInfoFromAddress('0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', this.chainId);
        } else if (gladiusOrder.baseToken === 'USDC') {
            baseTokenInfo = getTokenInfoFromAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', this.chainId);
        } else {
            console.error(`❌ Unsupported base token: ${gladiusOrder.baseToken}`);
            throw new Error(`Unsupported base token: ${gladiusOrder.baseToken}`);
        }
        
        if (gladiusOrder.quoteToken === 'RUBI') {
            quoteTokenInfo = getTokenInfoFromAddress('0xb3836098d1e94EC651D74D053d4a0813316B2a2f', this.chainId);
        } else if (gladiusOrder.quoteToken === 'DAI') {
            quoteTokenInfo = getTokenInfoFromAddress('0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', this.chainId);
        } else if (gladiusOrder.quoteToken === 'USDC') {
            quoteTokenInfo = getTokenInfoFromAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', this.chainId);
        } else {
            console.error(`❌ Unsupported quote token: ${gladiusOrder.quoteToken}`);
            throw new Error(`Unsupported quote token: ${gladiusOrder.quoteToken}`);
        }
        
        console.log(`  ✅ Base token: ${baseTokenInfo.symbol} (${baseTokenInfo.address})`);
        console.log(`  ✅ Quote token: ${quoteTokenInfo.symbol} (${quoteTokenInfo.address})`);
        
        // Parse absolute amounts from ODOS response (no rate math!)
        const odosInputAmount = parseFloat(formatUnits(odosQuote.inAmounts[0], baseTokenInfo.decimals));
        const odosOutputAmount = parseFloat(formatUnits(odosQuote.outAmounts[0], quoteTokenInfo.decimals));
        
        // Parse absolute amounts from Gladius order
        const gladiusBaseAmount = gladiusOrder.baseAmount;
        const gladiusQuoteAmount = gladiusOrder.quoteAmount;
        
        console.log(`  📊 ODOS amounts: ${odosInputAmount} ${baseTokenInfo.symbol} → ${odosOutputAmount} ${quoteTokenInfo.symbol}`);
        console.log(`  📊 Gladius amounts: ${gladiusBaseAmount} ${baseTokenInfo.symbol} ↔ ${gladiusQuoteAmount} ${quoteTokenInfo.symbol}`);
        
        // Calculate what we'd actually get vs what we'd actually pay
        let canFill = false;
        let fillAmount = 0;
        let surplus = 0;
        let potentialProfit = 0;
        let odosEffectivePrice = 0;
        let gladiusEffectivePrice = 0;
        
        if (gladiusOrder.type === 'BID') {
            // Gladius BID: Someone wants to buy base with quote
            // We can sell base to get quote on ODOS, then use that quote to fill the Gladius order
            
            // What we'd get from ODOS: odosOutputAmount quote tokens
            // What we'd pay on ODOS: odosInputAmount base tokens
            // What we'd get from Gladius: gladiusQuoteAmount quote tokens
            // What we'd pay to Gladius: gladiusBaseAmount base tokens
            
            // Check if we can fill the entire order
            if (odosInputAmount <= gladiusBaseAmount) {
                // Calculate effective prices using absolute amounts
                odosEffectivePrice = odosOutputAmount / odosInputAmount; // quote per base
                gladiusEffectivePrice = gladiusQuoteAmount / gladiusBaseAmount; // quote per base
                
                // If ODOS gives us more quote tokens than we need to pay for the Gladius order
                if (odosOutputAmount > gladiusQuoteAmount) {
                    canFill = true;
                    fillAmount = gladiusBaseAmount;
                    surplus = odosOutputAmount - gladiusQuoteAmount; // Extra quote tokens we keep
                    potentialProfit = surplus; // Profit in quote token terms
                }
            }
            
        } else {
            // Gladius ASK: Someone wants to sell base for quote
            // We sell base on ODOS to get quote, then use that quote to fill the Gladius order
            
            // What we'd get from ODOS: odosOutputAmount quote tokens (DAI)
            // What we'd pay on ODOS: odosInputAmount base tokens (RUBI)
            // What we'd get from Gladius: gladiusQuoteAmount quote tokens (DAI)
            // What we'd pay to Gladius: gladiusBaseAmount base tokens (RUBI)
            
            // Check if we can fill the entire order
            if (odosInputAmount >= gladiusBaseAmount) {
                // Calculate effective prices using absolute amounts
                odosEffectivePrice = odosOutputAmount / odosInputAmount; // quote per base (DAI per RUBI)
                gladiusEffectivePrice = gladiusQuoteAmount / gladiusBaseAmount; // quote per base (DAI per RUBI)
                
                // If ODOS gives us more quote tokens than we need to pay for the Gladius order
                if (odosOutputAmount > gladiusQuoteAmount) {
                    canFill = true;
                    fillAmount = gladiusBaseAmount;
                    surplus = odosOutputAmount - gladiusQuoteAmount; // Extra DAI we keep
                    potentialProfit = surplus; // Profit in DAI terms
                }
            }
        }
        
        // Calculate price differences using absolute amounts
        const priceDifference = Math.abs(odosEffectivePrice - gladiusEffectivePrice);
        const priceDifferencePercent = (priceDifference / gladiusEffectivePrice) * 100;
        
        // Calculate gas costs and net profit
        const gasEstimate = odosQuote.gasEstimate || 0;
        const gasCostUSD = odosQuote.gasEstimateValue || 0;
        const netProfit = potentialProfit - gasCostUSD;
        
        // Enhanced price analysis with higher precision
        console.log(`  💰 PRICE ANALYSIS (${new Date().toISOString()}):`);
        console.log(`    🎯 ODOS Rate: ${odosEffectivePrice.toFixed(8)} ${quoteTokenInfo.symbol} per ${baseTokenInfo.symbol}`);
        console.log(`    🔴 Gladius Rate: ${gladiusEffectivePrice.toFixed(8)} ${quoteTokenInfo.symbol} per ${baseTokenInfo.symbol}`);
        console.log(`    📊 Price Difference: ${priceDifference.toFixed(8)} ${quoteTokenInfo.symbol} per ${baseTokenInfo.symbol}`);
        console.log(`    📈 Price Difference: ${priceDifferencePercent.toFixed(4)}%`);
        
        // Show the actual amounts being compared
        console.log(`  📦 AMOUNT COMPARISON:`);
        console.log(`    🚀 ODOS: ${odosInputAmount.toFixed(8)} ${baseTokenInfo.symbol} → ${odosOutputAmount.toFixed(8)} ${quoteTokenInfo.symbol}`);
        console.log(`    🔴 Gladius: ${gladiusBaseAmount.toFixed(8)} ${baseTokenInfo.symbol} ↔ ${gladiusQuoteAmount.toFixed(8)} ${quoteTokenInfo.symbol}`);
        
        console.log(`  ✅ ARBITRAGE RESULT:`);
        console.log(`    Can fill: ${canFill ? 'YES 🎯' : 'NO ❌'}`);
        if (canFill) {
            console.log(`    💰 Surplus: ${surplus.toFixed(8)} ${quoteTokenInfo.symbol}`);
            console.log(`    🎯 Net profit: $${netProfit.toFixed(6)} USD`);
        }
        
        return {
            gladiusOrder,
            odosQuote,
            odosPrice: odosEffectivePrice,
            gladiusPrice: gladiusEffectivePrice,
            priceDifference,
            priceDifferencePercent,
            potentialProfit,
            canFill,
            fillAmount,
            surplus,
            gasEstimate,
            gasCostUSD,
            netProfit
        };
    }

    /**
     * Display all arbitrage opportunities found
     */
    async displayArbitrageOpportunities(): Promise<void> {
        if (this.arbitrageOpportunities.length === 0) {
            console.log('\n❌ No arbitrage opportunities found');
            return;
        }
        
        console.log('\n💰 ARBITRAGE OPPORTUNITIES FOUND!');
        console.log('=====================================');
        console.log(`Total opportunities: ${this.arbitrageOpportunities.length}`);
        console.log('');
        
        // Sort by net profit (highest first)
        const sortedOpportunities = [...this.arbitrageOpportunities].sort((a, b) => b.netProfit - a.netProfit);
        
        sortedOpportunities.forEach((opp, index) => {
            const order = opp.gladiusOrder;
            console.log(`\n🎯 Opportunity ${index + 1}:`);
            console.log(`  📊 Order: ${order.type} ${order.baseAmount.toFixed(6)} ${order.baseToken} @ ${order.price.toFixed(6)} ${order.quoteToken}`);
            console.log(`  🆔 Hash: ${order.hash.slice(0, 8)}...`);
            console.log(`  ⏰ Time Remaining: ${order.timeRemaining}`);
            console.log(`  💰 Gladius: ${order.baseAmount.toFixed(6)} ${order.baseToken} ↔ ${order.quoteAmount.toFixed(6)} ${order.quoteToken}`);
            
            // Display Dutch auction information if applicable
            if (order.isDutchOrder) {
                console.log(`  🕐 Dutch Auction Details:`);
                console.log(`    📈 Start: ${order.startBaseAmount.toFixed(6)} ${order.baseToken} ↔ ${order.startQuoteAmount.toFixed(6)} ${order.quoteToken}`);
                console.log(`    📉 End: ${order.endBaseAmount.toFixed(6)} ${order.baseToken} ↔ ${order.endQuoteAmount.toFixed(6)} ${order.quoteToken}`);
                console.log(`    🎯 Current: ${order.currentBaseAmount.toFixed(6)} ${order.baseToken} ↔ ${order.currentQuoteAmount.toFixed(6)} ${order.quoteToken}`);
                console.log(`    ⏱️ Decay: ${order.decayStartTime} → ${order.decayEndTime} (${Math.floor((Date.now() / 1000 - order.decayStartTime) / (order.decayEndTime - order.decayStartTime) * 100)}% complete)`);
            }
            
            // Get token info for proper decimal handling - use hardcoded addresses
            let baseTokenInfo, quoteTokenInfo;
            let canDisplay = true;
            
            if (order.baseToken === 'RUBI') {
                baseTokenInfo = getTokenInfoFromAddress('0xb3836098d1e94EC651D74D053d4a0813316B2a2f', this.chainId);
            } else if (order.baseToken === 'DAI') {
                baseTokenInfo = getTokenInfoFromAddress('0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', this.chainId);
            } else if (order.baseToken === 'USDC') {
                baseTokenInfo = getTokenInfoFromAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', this.chainId);
            } else {
                console.error(`❌ Unsupported base token: ${order.baseToken}`);
                canDisplay = false;
            }
            
            if (order.quoteToken === 'RUBI') {
                quoteTokenInfo = getTokenInfoFromAddress('0xb3836098d1e94EC651D74D053d4a0813316B2a2f', this.chainId);
            } else if (order.quoteToken === 'DAI') {
                quoteTokenInfo = getTokenInfoFromAddress('0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', this.chainId);
            } else if (order.quoteToken === 'USDC') {
                quoteTokenInfo = getTokenInfoFromAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', this.chainId);
            } else {
                console.error(`❌ Unsupported quote token: ${order.quoteToken}`);
                canDisplay = false;
            }
            
            if (canDisplay && baseTokenInfo && quoteTokenInfo) {
                console.log(`  🚀 ODOS: ${parseFloat(formatUnits(opp.odosQuote.inAmounts[0], baseTokenInfo.decimals)).toFixed(6)} ${order.baseToken} ↔ ${parseFloat(formatUnits(opp.odosQuote.outAmounts[0], quoteTokenInfo.decimals)).toFixed(6)} ${order.quoteToken}`);
                console.log(`  📈 Price Difference: ${opp.priceDifferencePercent.toFixed(2)}%`);
                console.log(`  💎 Potential Profit: $${opp.potentialProfit.toFixed(4)} USD`);
                console.log(`  ⛽ Gas Cost: $${opp.gasCostUSD.toFixed(4)} USD`);
                console.log(`  🎯 Net Profit: $${opp.netProfit.toFixed(4)} USD`);
                console.log(`  ✅ Can Fill: ${opp.canFill ? 'YES' : 'NO'}`);
                
                if (opp.canFill) {
                    console.log(`  📦 Fill Amount: ${opp.fillAmount.toFixed(6)} ${order.baseToken}`);
                    console.log(`  💰 Surplus: ${opp.surplus.toFixed(6)} ${order.quoteToken} (${order.quoteToken})`);
                }
            } else {
                console.log(`  ❌ Skipping display due to unsupported tokens`);
            }
        });
        
        // Summary
        const totalPotentialProfit = sortedOpportunities.reduce((sum, opp) => sum + opp.potentialProfit, 0);
        const totalNetProfit = sortedOpportunities.reduce((sum, opp) => sum + opp.netProfit, 0);
        const totalGasCost = sortedOpportunities.reduce((sum, opp) => sum + opp.gasCostUSD, 0);
        
        console.log('\n📊 SUMMARY:');
        console.log(`  💰 Total Potential Profit: $${totalPotentialProfit.toFixed(4)} USD`);
        console.log(`  ⛽ Total Gas Cost: $${totalGasCost.toFixed(4)} USD`);
        console.log(`  🎯 Total Net Profit: $${totalNetProfit.toFixed(4)} USD`);
        console.log(`  📈 Profitable Opportunities: ${sortedOpportunities.filter(opp => opp.netProfit > 0).length}`);
    }

    /**
     * Get all outstanding orders in human-readable format
     */
    async getAllOutstandingOrders(): Promise<ParsedOrder[]> {
        // If we haven't fetched orders recently, fetch them now
        if (Date.now() - this.lastOrderUpdate > this.pollingInterval) {
            await this.pollOrders();
        }
        
        return this.outstandingOrders;
    }

    /**
     * Get orders filtered by type (BID or ASK)
     */
    async getOrdersByType(type: 'BID' | 'ASK'): Promise<ParsedOrder[]> {
        const orders = await this.getAllOutstandingOrders();
        return orders.filter(order => order.type === type);
    }

    /**
     * Get orders filtered by token pair
     */
    async getOrdersByTokenPair(baseToken: string, quoteToken: string): Promise<ParsedOrder[]> {
        const orders = await this.getAllOutstandingOrders();
        return orders.filter(order => 
            order.baseToken.toUpperCase() === baseToken.toUpperCase() &&
            order.quoteToken.toUpperCase() === quoteToken.toUpperCase()
        );
    }

    /**
     * Get the current order book summary
     */
    async getOrderBookSummary(): Promise<{
        totalOrders: number;
        bids: number;
        asks: number;
        expired: number;
        lastUpdate: string;
    }> {
        const orders = await this.getAllOutstandingOrders();
        const bids = orders.filter(order => order.type === 'BID').length;
        const asks = orders.filter(order => order.type === 'ASK').length;
        const expired = orders.filter(order => order.isExpired).length;
        
        return {
            totalOrders: orders.length,
            bids,
            asks,
            expired,
            lastUpdate: new Date(this.lastOrderUpdate).toLocaleString()
        };
    }

    /**
     * Display all outstanding orders in a nicely formatted console output
     */
    async displayAllOutstandingOrders(): Promise<void> {
        const orders = await this.getAllOutstandingOrders();
        const summary = await this.getOrderBookSummary();
        
        console.log('\n📊 GLADIUS ORDER BOOK SUMMARY');
        console.log('================================');
        console.log(`🌐 Chain ID: ${this.chainId}`);
        console.log(`📅 Last Updated: ${summary.lastUpdate}`);
        console.log(`📈 Total Active Orders: ${summary.totalOrders}`);
        console.log(`🟢 Bids: ${summary.bids}`);
        console.log(`🔴 Asks: ${summary.asks}`);
        console.log(`⏰ Expired: ${summary.expired}`);
        console.log('');
        
        if (orders.length === 0) {
            console.log('❌ No outstanding orders found');
            return;
        }
        
        // Group orders by token pair
        const ordersByPair = this.groupOrdersByTokenPair(orders);
        
        for (const [pair, pairOrders] of Object.entries(ordersByPair)) {
            console.log(`\n💱 ${pair}`);
            console.log('─'.repeat(pair.length + 2));
            
            // Sort orders by price (bids descending, asks ascending)
            const bids = pairOrders.filter(o => o.type === 'BID').sort((a, b) => b.price - a.price);
            const asks = pairOrders.filter(o => o.type === 'ASK').sort((a, b) => a.price - b.price);
            
            // Display bids
            if (bids.length > 0) {
                console.log(`\n🟢 BIDS (${bids.length}):`);
                bids.forEach((order, index) => {
                    console.log(`  ${index + 1}. ${order.baseAmount.toFixed(6)} ${order.baseToken} @ ${order.price.toFixed(6)} ${order.quoteToken}`);
                    console.log(`     💰 Total: ${order.quoteAmount.toFixed(6)} ${order.quoteToken} | ⏰ ${order.timeRemaining} | 🆔 ${order.hash.slice(0, 8)}...`);
                });
            }
            
            // Display asks
            if (asks.length > 0) {
                console.log(`\n🔴 ASKS (${asks.length}):`);
                asks.forEach((order, index) => {
                    console.log(`  ${index + 1}. ${order.baseAmount.toFixed(6)} ${order.baseToken} @ ${order.price.toFixed(6)} ${order.quoteToken}`);
                    console.log(`     💰 Total: ${order.quoteAmount.toFixed(6)} ${order.quoteToken} | ⏰ ${order.timeRemaining} | 🆔 ${order.hash.slice(0, 8)}...`);
                });
            }
        }
        
        console.log('\n✨ Order book display completed');
    }

    /**
     * Group orders by token pair
     */
    private groupOrdersByTokenPair(orders: ParsedOrder[]): { [pair: string]: ParsedOrder[] } {
        const grouped: { [pair: string]: ParsedOrder[] } = {};
        
        orders.forEach(order => {
            const pair = `${order.baseToken}/${order.quoteToken}`;
            if (!grouped[pair]) {
                grouped[pair] = [];
            }
            grouped[pair].push(order);
        });
        
        return grouped;
    }

    /**
     * Get the ODOS filler instance for price comparisons
     */
    getODOSFiller(): ODOSFiller {
        return this.odosFiller;
    }

    /**
     * Get current monitoring status
     */
    getStatus(): {
        isPolling: boolean;
        chainId: number;
        lastUpdate: number;
        orderCount: number;
        arbitrageOpportunities: number;
    } {
        return {
            isPolling: this.isPolling,
            chainId: this.chainId,
            lastUpdate: this.lastOrderUpdate,
            orderCount: this.outstandingOrders.length,
            arbitrageOpportunities: this.arbitrageOpportunities.length
        };
    }
}
