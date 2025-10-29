// src/fillers/example.ts
import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { ODOSFiller } from "./odosFiller";

dotenv.config();

async function runODOSFillerExample() {
    // Get command line arguments
    const args = process.argv.slice(2);

    if (args.length < 4) {
        console.error("Please provide all required arguments: chainID, providerUrl, baseTokenAddress, quoteTokenAddress");
        console.error("Example: ts-node src/fillers/example.ts 10 https://mainnet.optimism.io 0x4200000000000000000000000000000000000006 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85");
        console.error("Optional arguments: amount");
        process.exit(1);
    }

    // Parse arguments
    const chainID = parseInt(args[0], 10);
    const providerUrl = args[1];
    const baseTokenAddress = args[2];
    const quoteTokenAddress = args[3];
    const amount = args[4] || "1"; // Default to 1 token

    // Validate required inputs
    if (isNaN(chainID)) {
        throw new Error("Invalid chainID. Must be a number.");
    }
    if (!ethers.utils.isAddress(baseTokenAddress) || !ethers.utils.isAddress(quoteTokenAddress)) {
        throw new Error("Invalid token addresses. Must be valid Ethereum addresses.");
    }

    // Log configuration
    console.log("Starting ODOS Filler v3 Example with the following configuration:");
    console.log({
        chainID,
        providerUrl,
        baseTokenAddress,
        quoteTokenAddress,
        amount
    });

    try {
        // Create provider
        const provider = new ethers.providers.JsonRpcProvider(providerUrl);

        // Create ODOS filler instance
        const odosFiller = new ODOSFiller(chainID, provider);

        console.log("\n=== ODOS Filler v3 Example ===");
        console.log(`Chain ID: ${chainID}`);
        console.log(`Base Token: ${baseTokenAddress}`);
        console.log(`Quote Token: ${quoteTokenAddress}`);
        console.log(`Amount: ${amount}`);

        // Get token info
        console.log("\n--- Token Information ---");
        const baseTokenInfo = odosFiller.getTokenInfo(baseTokenAddress);
        const quoteTokenInfo = odosFiller.getTokenInfo(quoteTokenAddress);
        console.log(`Base Token: ${baseTokenInfo.symbol} (${baseTokenInfo.name}) - Decimals: ${baseTokenInfo.decimals}`);
        console.log(`Quote Token: ${quoteTokenInfo.symbol} (${quoteTokenInfo.name}) - Decimals: ${quoteTokenInfo.decimals}`);

        // Get quote
        console.log("\n--- Getting Quote (v3 API) ---");
        const quote = await odosFiller.getQuote(baseTokenAddress, quoteTokenAddress, amount);
        console.log(`Quote received:`);
        console.log(`  Input Amount: ${odosFiller.parseAmount(quote.inAmounts[0], baseTokenAddress)} ${baseTokenInfo.symbol}`);
        console.log(`  Output Amount: ${odosFiller.parseAmount(quote.outAmounts[0], quoteTokenAddress)} ${quoteTokenInfo.symbol}`);
        console.log(`  Gas Estimate: ${quote.gasEstimate}`);
        console.log(`  Gas Estimate Value (USD): $${quote.gasEstimateValue?.toFixed(2) || 'N/A'}`);
        console.log(`  Gas Price: ${quote.gweiPerGas} gwei`);
        console.log(`  Price Impact: ${quote.priceImpact}%`);
        console.log(`  Percent Diff: ${quote.percentDiff}%`);
        console.log(`  Net Out Value (USD): $${quote.netOutValue?.toFixed(2) || 'N/A'}`);
        console.log(`  Path ID: ${quote.pathId}`);
        if (quote.traceId) {
            console.log(`  Trace ID: ${quote.traceId}`);
        }
        if (quote.deprecated) {
            console.log(`  ⚠️  Deprecated: ${quote.deprecated}`);
        }

        // Get token price
        console.log("\n--- Token Price ---");
        const price = await odosFiller.getTokenPrice(baseTokenAddress, quoteTokenAddress, amount);
        console.log(`Price: 1 ${baseTokenInfo.symbol} = ${price.toFixed(6)} ${quoteTokenInfo.symbol}`);

        // Get best bid and ask
        console.log("\n--- Best Bid and Ask ---");
        const { bid, ask } = await odosFiller.getBestBidAndAsk(baseTokenAddress, quoteTokenAddress, amount);
        console.log(`Best Bid: ${bid.toFixed(6)} ${quoteTokenInfo.symbol} per ${baseTokenInfo.symbol}`);
        console.log(`Best Ask: ${ask.toFixed(6)} ${quoteTokenInfo.symbol} per ${baseTokenInfo.symbol}`);

        // Get mid-point price
        console.log("\n--- Mid-Point Price ---");
        const midPrice = await odosFiller.getMidPointPrice(baseTokenAddress, quoteTokenAddress, amount);
        console.log(`Mid-Point Price: ${midPrice.toFixed(6)} ${quoteTokenInfo.symbol} per ${baseTokenInfo.symbol}`);

        // Get price impact
        console.log("\n--- Price Impact ---");
        const priceImpact = await odosFiller.getPriceImpact(baseTokenAddress, quoteTokenAddress, amount);
        console.log(`Price Impact: ${priceImpact}%`);

        // Get gas estimate
        console.log("\n--- Gas Estimate ---");
        const gasEstimate = await odosFiller.getGasEstimate(baseTokenAddress, quoteTokenAddress, amount);
        console.log(`Gas Estimate: ${gasEstimate} gas units`);

        // Get gas price in gwei
        console.log("\n--- Gas Price ---");
        const gasPrice = await odosFiller.getGasPrice(baseTokenAddress, quoteTokenAddress, amount);
        console.log(`Gas Price: ${gasPrice} gwei`);

        // Get gas estimate value in USD
        console.log("\n--- Gas Estimate Value ---");
        const gasEstimateValue = await odosFiller.getGasEstimateValue(baseTokenAddress, quoteTokenAddress, amount);
        console.log(`Gas Estimate Value: $${gasEstimateValue.toFixed(2)} USD`);

        // Get percent difference
        console.log("\n--- Percent Difference ---");
        const percentDiff = await odosFiller.getPercentDiff(baseTokenAddress, quoteTokenAddress, amount);
        console.log(`Percent Difference: ${percentDiff}%`);

        // Get supported chains
        console.log("\n--- Supported Chains ---");
        try {
            const supportedChains = await odosFiller.getSupportedChains();
            console.log(`Total supported chains: ${supportedChains.length}`);
            if (supportedChains.length > 0) {
                console.log("First 5 chains:");
                supportedChains.slice(0, 5).forEach((chain: any, index: number) => {
                    console.log(`  ${index + 1}. Chain ID: ${chain.chainId} - ${chain.name || 'Unknown'}`);
                });
            }
        } catch (error) {
            console.log("Could not fetch supported chains");
        }

        // Get liquidity sources for current chain
        console.log("\n--- Liquidity Sources ---");
        try {
            const liquiditySources = await odosFiller.getLiquiditySources(chainID);
            console.log(`Total liquidity sources on chain ${chainID}: ${liquiditySources.length}`);
            if (liquiditySources.length > 0) {
                console.log("First 5 liquidity sources:");
                liquiditySources.slice(0, 5).forEach((source: any, index: number) => {
                    console.log(`  ${index + 1}. ${source.name || source.address || 'Unknown'}`);
                });
            }
        } catch (error) {
            console.log("Could not fetch liquidity sources");
        }

        // Get supported tokens (optional - might be slow)
        console.log("\n--- Supported Tokens (first 5) ---");
        try {
            const supportedTokens = await odosFiller.getSupportedTokens(chainID);
            console.log(`Total supported tokens: ${supportedTokens.length}`);
            if (supportedTokens.length > 0) {
                console.log("First 5 tokens:");
                supportedTokens.slice(0, 5).forEach((token: any, index: number) => {
                    console.log(`  ${index + 1}. ${token.symbol} - ${token.name}`);
                });
            }
        } catch (error) {
            console.log("Could not fetch supported tokens (this is normal for some chains)");
        }

        console.log("\n=== Example completed successfully! ===");

    } catch (error) {
        console.error("Error running ODOS filler example:", error);
        process.exit(1);
    }
}

// Start the example when the script is executed
runODOSFillerExample()
    .then(() => console.log("Example finished successfully"))
    .catch((error) => console.error("Error running example:", error));
