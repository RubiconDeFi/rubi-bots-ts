import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { OnchainAggregatorBidStrategy } from "./onchainAggregatorBid";
import { TokenInfo } from "@uniswap/token-lists";
import { getTokenInfoFromAddress } from "../../utils/rubicon";
import { RUBICON_MARKET_ADDRESS_BY_CHAIN_ID } from "../../config/rubicon";

dotenv.config();

async function startOnchainAggregatorBidStrategy() {
    const args = process.argv.slice(2);

    if (args.length < 6) {
        console.error("Please provide all required arguments: chainID, providerUrl, baseAddress, quoteAddress, baseSymbol, quoteSymbol");
        console.error("Optional arguments: pollInterval");
        process.exit(1);
    }

    // Parse arguments
    const chainID = parseInt(args[0], 10);
    const providerUrl = args[1];
    const baseAddress = args[2];
    const quoteAddress = args[3];
    const baseSymbol = args[4];
    const quoteSymbol = args[5];
    const pollInterval = args[6] ? parseInt(args[6], 10) : undefined;

    // Validate required inputs
    if (isNaN(chainID)) {
        throw new Error("Invalid chainID. Must be a number.");
    }
    if (!ethers.utils.isAddress(baseAddress) || !ethers.utils.isAddress(quoteAddress)) {
        throw new Error("Invalid base or quote address. Must be valid Ethereum addresses.");
    }
    if (!baseSymbol || !quoteSymbol) {
        throw new Error("Base and quote symbols cannot be empty.");
    }

    // Validate optional inputs if provided
    if (pollInterval !== undefined && isNaN(pollInterval)) {
        throw new Error("Invalid pollInterval. Must be a number.");
    }

    // Log all configuration values
    console.log("Starting Onchain Aggregator Bid Strategy with the following configuration:");
    console.log({
        chainID,
        providerUrl,
        baseAddress,
        quoteAddress,
        baseSymbol,
        quoteSymbol,
        pollInterval: pollInterval || "default",
    });

    // Create a new provider instance
    const provider = new ethers.providers.JsonRpcProvider(providerUrl);

    // User wallet with pk in .env as PRIVATE_KEY
    if (!process.env.PRIVATE_KEY) {
        console.error("Please provide a private key in the .env file");
        process.exit(1);
    }
    const userWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Create TokenInfo objects (you might want to fetch decimals from the blockchain in a real scenario)
    // Fetch from token list
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
        RUBICON_MARKET_ADDRESS_BY_CHAIN_ID[chainID]
    );

    // Function to run the strategy
    async function runStrategy() {
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

        // Schedule the next execution
        setTimeout(runStrategy, pollInterval || 60000); // Default to 1 minute if not specified
    }

    // Start running the strategy
    runStrategy();
}

// Start the strategy when the script is executed
startOnchainAggregatorBidStrategy()
    .then(() => console.log("Strategy started successfully"))
    .catch((error) => console.error("Error starting strategy:", error));
