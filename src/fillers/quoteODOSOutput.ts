#!/usr/bin/env ts-node
// src/fillers/quoteODOSOutput.ts
import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { ODOSFiller } from "./odosFiller";
import { tokenList } from "../config/tokens";

dotenv.config();

interface TokenLookupResult {
    token: any;
    chainId: number;
}

function findTokenBySymbol(symbol: string): TokenLookupResult[] {
    const results: TokenLookupResult[] = [];
    
    // Search through all tokens in all chains
    tokenList.tokens.forEach(token => {
        if (token.symbol.toUpperCase() === symbol.toUpperCase()) {
            results.push({
                token,
                chainId: token.chainId
            });
        }
    });
    
    return results;
}

function getChainName(chainId: number): string {
    const chainNames: { [key: number]: string } = {
        1: 'Ethereum Mainnet',
        10: 'Optimism Mainnet',
        137: 'Polygon Mainnet',
        42161: 'Arbitrum Mainnet',
        8453: 'Base Mainnet',
        5: 'Goerli Testnet',
        420: 'Optimism Goerli',
        80001: 'Polygon Mumbai',
        421613: 'Arbitrum Goerli'
    };
    return chainNames[chainId] || `Chain ${chainId}`;
}

function displayTokenOptions(symbol: string, results: TokenLookupResult[]) {
    console.log(`\n🔍 Found ${results.length} token(s) with symbol "${symbol}":`);
    results.forEach((result, index) => {
        const chainName = getChainName(result.chainId);
        console.log(`  ${index + 1}. ${result.token.name} (${result.token.symbol}) on ${chainName} (Chain ID: ${result.chainId})`);
        console.log(`     Address: ${result.token.address}`);
    });
}

function displayChainSelectionPrompt(fromSymbol: string, toSymbol: string, fromTokens: TokenLookupResult[], toTokens: TokenLookupResult[]) {
    console.log(`\n⚠️  IMPORTANT: Chain selection matters!`);
    console.log(`   Different chains may have different prices, liquidity, and gas costs.`);
    console.log(`   For example, RUBI on Base (8453) vs RUBI on Optimism (10) may have very different prices.`);
    
    // Find common chains
    const commonChains = fromTokens
        .map(ft => ft.chainId)
        .filter(chainId => toTokens.some(tt => tt.chainId === chainId));
    
    if (commonChains.length > 0) {
        console.log(`\n🌐 Common chains where both tokens exist:`);
        commonChains.forEach(chainId => {
            const fromToken = fromTokens.find(t => t.chainId === chainId);
            const toToken = toTokens.find(t => t.chainId === chainId);
            const chainName = getChainName(chainId);
            console.log(`  • ${chainName} (${chainId}): ${fromToken?.token.symbol} → ${toToken?.token.symbol}`);
        });
        
        if (commonChains.length === 1) {
            console.log(`\n✅ Only one common chain found. Using Chain ID ${commonChains[0]}.`);
            return commonChains[0];
        } else {
            console.log(`\n📋 Multiple common chains found. Please specify a chain ID:`);
            console.log(`   Example: yarn quoteODOSOutput ${fromSymbol} 10000 ${toSymbol} <chainId>`);
            console.log(`   Available chain IDs: ${commonChains.join(', ')}`);
            return null;
        }
    } else {
        console.log(`\n❌ No common chains found between "${fromSymbol}" and "${toSymbol}"`);
        console.log(`\nAvailable options:`);
        displayTokenOptions(fromSymbol, fromTokens);
        displayTokenOptions(toSymbol, toTokens);
        return null;
    }
}

async function getQuoteForTokens(
    fromSymbol: string,
    fromAmount: string,
    toSymbol: string,
    chainId?: number
) {
    try {
        // Find tokens by symbol
        const fromTokens = findTokenBySymbol(fromSymbol);
        const toTokens = findTokenBySymbol(toSymbol);
        
        if (fromTokens.length === 0) {
            console.error(`❌ No tokens found with symbol "${fromSymbol}"`);
            return;
        }
        
        if (toTokens.length === 0) {
            console.error(`❌ No tokens found with symbol "${toSymbol}"`);
            return;
        }
        
        // Show all available options first
        if (fromTokens.length > 1) {
            console.log(`\n📋 "${fromSymbol}" exists on multiple chains:`);
            displayTokenOptions(fromSymbol, fromTokens);
        }
        
        if (toTokens.length > 1) {
            console.log(`\n📋 "${toSymbol}" exists on multiple chains:`);
            displayTokenOptions(toSymbol, toTokens);
        }
        
        // Filter by chain if specified
        let fromToken: TokenLookupResult;
        let toToken: TokenLookupResult;
        
        if (chainId) {
            fromToken = fromTokens.find(t => t.chainId === chainId);
            toToken = toTokens.find(t => t.chainId === chainId);
            
            if (!fromToken || !toToken) {
                console.error(`❌ One or both tokens not found on chain ${chainId}`);
                console.log(`\nAvailable options:`);
                if (fromTokens.length > 0) {
                    displayTokenOptions(fromSymbol, fromTokens);
                }
                if (toTokens.length > 0) {
                    displayTokenOptions(toSymbol, toTokens);
                }
                return;
            }
        } else {
            // If no chain specified, show chain selection prompt
            const selectedChainId = displayChainSelectionPrompt(fromSymbol, toSymbol, fromTokens, toTokens);
            if (selectedChainId === null) {
                console.log(`\n💡 Tip: Always specify a chain ID when tokens exist on multiple chains for accurate pricing.`);
                return;
            }
            
            fromToken = fromTokens.find(t => t.chainId === selectedChainId)!;
            toToken = toTokens.find(t => t.chainId === selectedChainId)!;
        }
        
        const chainName = getChainName(fromToken.chainId);
        console.log(`\n📊 Getting ODOS v3 quote on ${chainName} (Chain ID: ${fromToken.chainId}):`);
        console.log(`  From: ${fromAmount} ${fromToken.token.symbol} (${fromToken.token.name})`);
        console.log(`  To: ${toToken.token.symbol} (${toToken.token.name})`);
        console.log(`  Chain: ${chainName} (${fromToken.chainId})`);
        console.log(`  From Address: ${fromToken.token.address}`);
        console.log(`  To Address: ${toToken.token.address}`);
        
        // Create provider (using a default RPC for the chain)
        const rpcUrls: { [chainId: number]: string } = {
            1: 'https://eth.llamarpc.com',
            10: 'https://mainnet.optimism.io',
            137: 'https://polygon-rpc.com',
            42161: 'https://arb1.arbitrum.io/rpc',
            8453: 'https://mainnet.base.org',
            5: 'https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
            420: 'https://goerli.optimism.io',
            80001: 'https://polygon-mumbai.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
            421613: 'https://goerli-rollup.arbitrum.io/rpc'
        };
        
        const rpcUrl = rpcUrls[fromToken.chainId];
        if (!rpcUrl) {
            console.error(`❌ No default RPC URL configured for chain ${fromToken.chainId}`);
            console.log(`Please provide a custom RPC URL via environment variable or update the script.`);
            return;
        }
        
        // Create ODOS filler instance
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        const odosFiller = new ODOSFiller(fromToken.chainId, provider);
        
        // Get quote
        console.log(`\n⏳ Fetching quote from ODOS v3 API on ${chainName}...`);
        const quote = await odosFiller.getQuote(
            fromToken.token.address,
            toToken.token.address,
            fromAmount
        );
        
        // Calculate output amount in human readable format
        const outputAmount = odosFiller.parseAmount(quote.outAmounts[0], toToken.token.address);
        
        // Display results
        console.log(`\n✅ Quote received from ODOS v3 on ${chainName}:`);
        console.log(`  📥 Input: ${fromAmount} ${fromToken.token.symbol}`);
        console.log(`  📤 Output: ${outputAmount} ${toToken.token.symbol}`);
        console.log(`  💰 Price: 1 ${fromToken.token.symbol} = ${(parseFloat(outputAmount) / parseFloat(fromAmount)).toFixed(6)} ${toToken.token.symbol}`);
        console.log(`  ⛽ Gas Estimate: ${quote.gasEstimate} gas units`);
        console.log(`  💵 Gas Estimate Value: $${quote.gasEstimateValue?.toFixed(2) || 'N/A'} USD`);
        console.log(`  🔥 Gas Price: ${quote.gweiPerGas} gwei`);
        console.log(`  📊 Price Impact: ${quote.priceImpact}%`);
        console.log(`  📈 Percent Diff: ${quote.percentDiff}%`);
        console.log(`  💎 Net Out Value: $${quote.netOutValue?.toFixed(2) || 'N/A'} USD`);
        console.log(`  🆔 Path ID: ${quote.pathId}`);
        
        if (quote.traceId) {
            console.log(`  🔍 Trace ID: ${quote.traceId}`);
        }
        
        if (quote.deprecated) {
            console.log(`  ⚠️  Deprecated: ${quote.deprecated}`);
        }
        
        console.log(`\n🎯 Summary: You can get ${outputAmount} ${toToken.token.symbol} for ${fromAmount} ${fromToken.token.symbol} on ${chainName}`);
        console.log(`\n💡 Note: This quote is specific to ${chainName}. Prices may vary significantly on other chains!`);
        
    } catch (error) {
        console.error(`\n❌ Error getting quote:`, error);
        if (error instanceof Error) {
            console.error(`   Message: ${error.message}`);
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
        console.log(`\n🚀 ODOS Quote CLI - Get token swap quotes from ODOS v3`);
        console.log(`\n⚠️  IMPORTANT: Chain selection matters!`);
        console.log(`   Different chains may have very different prices, liquidity, and gas costs.`);
        console.log(`   For example, RUBI on Base (8453) vs RUBI on Optimism (10) may have very different prices.`);
        console.log(`\nUsage:`);
        console.log(`  yarn quoteODOSOutput <fromSymbol> <fromAmount> <toSymbol> [chainId]`);
        console.log(`\nExamples:`);
        console.log(`  yarn quoteODOSOutput RUBI 10000 DAI 8453    # RUBI → DAI on Base`);
        console.log(`  yarn quoteODOSOutput RUBI 10000 DAI 10     # RUBI → DAI on Optimism`);
        console.log(`  yarn quoteODOSOutput WETH 1 USDC 1         # WETH → USDC on Ethereum`);
        console.log(`  yarn quoteODOSOutput ETH 0.5 USDT 1        # ETH → USDT on Ethereum`);
        console.log(`\nArguments:`);
        console.log(`  fromSymbol   - Symbol of the token you're swapping from (e.g., RUBI, WETH, USDC)`);
        console.log(`  fromAmount   - Amount of the from token (e.g., 10000, 1.5, 0.1)`);
        console.log(`  toSymbol     - Symbol of the token you're swapping to (e.g., DAI, USDC, WETH)`);
        console.log(`  chainId      - Optional: Specific chain ID to use (e.g., 1, 10, 42161, 8453)`);
        console.log(`\nPopular chains:`);
        console.log(`  1     - Ethereum Mainnet`);
        console.log(`  10    - Optimism Mainnet`);
        console.log(`  137   - Polygon Mainnet`);
        console.log(`  42161 - Arbitrum Mainnet`);
        console.log(`  8453  - Base Mainnet (Important for RUBI!)`);
        console.log(`\nAvailable tokens: ${tokenList.tokens.length} tokens across ${new Set(tokenList.tokens.map(t => t.chainId)).size} chains`);
        process.exit(1);
    }
    
    const [fromSymbol, fromAmount, toSymbol, chainIdStr] = args;
    const chainId = chainIdStr ? parseInt(chainIdStr, 10) : undefined;
    
    if (isNaN(parseFloat(fromAmount))) {
        console.error(`❌ Invalid amount: "${fromAmount}". Please provide a valid number.`);
        process.exit(1);
    }
    
    if (chainId && isNaN(chainId)) {
        console.error(`❌ Invalid chain ID: "${chainIdStr}". Please provide a valid number.`);
        process.exit(1);
    }
    
    console.log(`\n🚀 ODOS Quote CLI v3`);
    console.log(`Getting quote for ${fromAmount} ${fromSymbol} → ${toSymbol}${chainId ? ` on chain ${chainId}` : ''}`);
    
    await getQuoteForTokens(fromSymbol, fromAmount, toSymbol, chainId);
}

// Run the CLI
main()
    .then(() => {
        console.log(`\n✨ Quote request completed`);
        process.exit(0);
    })
    .catch((error) => {
        console.error(`\n💥 Fatal error:`, error);
        process.exit(1);
    });
