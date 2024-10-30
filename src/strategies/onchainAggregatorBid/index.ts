import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { OnchainAggregatorBidStrategy } from "./onchainAggregatorBid";
import { getTokenInfoFromAddress } from "../../utils/rubicon";
import { RUBICON_MARKET_ADDRESS_BY_CHAIN_ID } from "../../config/rubicon";

dotenv.config();

async function startOnchainAggregatorBidStrategy() {
    const args = process.argv.slice(2);

    if (args.length < 7) {
        console.error("Please provide all required arguments: chainID, providerUrl, baseAddress, quoteAddress, baseSymbol, quoteSymbol, marketAidAddress");
        console.error("Optional arguments: pollInterval, volatilityThreshold, maxDeviation");
        process.exit(1);
    }

    // Parse arguments
    const chainID = parseInt(args[0], 10);
    const providerUrl = args[1];
    const baseAddress = args[2];
    const quoteAddress = args[3];
    const baseSymbol = args[4];
    const quoteSymbol = args[5];
    const marketAidAddress = args[6];
    const pollInterval = args[7] ? parseInt(args[7], 10) : 60000; // Default to 1 minute if not specified
    const volatilityThreshold = args[8] ? parseFloat(args[8]) : 0.02; // Default to 2%
    const maxDeviation = args[9] ? parseFloat(args[9]) : 0.01; // Default to 1%

    // Validate inputs
    if (isNaN(chainID) || !ethers.utils.isAddress(baseAddress) || !ethers.utils.isAddress(quoteAddress) || !baseSymbol || !quoteSymbol) {
        throw new Error("Invalid input parameters");
    }

    // Log configuration
    console.log("Starting Onchain Aggregator Bid Strategy with the following configuration:", {
        chainID,
        providerUrl,
        baseAddress,
        quoteAddress,
        baseSymbol,
        quoteSymbol,
        marketAidAddress,
        pollInterval,
        volatilityThreshold,
        maxDeviation
    });

    // Set up provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(providerUrl);
    if (!process.env.PRIVATE_KEY) {
        throw new Error("Please provide a private key in the .env file");
    }
    const userWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Create TokenInfo objects
    const baseToken = getTokenInfoFromAddress(baseAddress, chainID);
    const quoteToken = getTokenInfoFromAddress(quoteAddress, chainID);

    // Instantiate the OnchainAggregatorBidStrategy
    const strategy = new OnchainAggregatorBidStrategy(
        baseSymbol,
        quoteSymbol,
        chainID,
        baseToken,
        quoteToken,
        provider,
        userWallet,
        RUBICON_MARKET_ADDRESS_BY_CHAIN_ID[chainID],
        marketAidAddress,
        {
            volatilityThreshold,
            maxDeviation
        }
    );

    // Function to execute the strategy
    async function executeStrategy() {
        try {
            const shouldExecute = await strategy.shouldExecute();
            if (shouldExecute) {
                await strategy.execute(provider);
            } else {
                console.log("Strategy execution conditions not met.");
            }
        } catch (error) {
            console.error("Error executing strategy:", error);
        }
    }

    // Start periodic execution
    setInterval(executeStrategy, pollInterval);

    // Initial execution
    await executeStrategy();

    console.log("Strategy started successfully");
}

// Start the strategy
startOnchainAggregatorBidStrategy().catch((error) => console.error("Error starting strategy:", error));
