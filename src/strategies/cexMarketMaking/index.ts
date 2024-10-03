// src/strategies/cexMarketMaking/index.ts
import * as dotenv from "dotenv";

import { ethers } from "ethers";
import { CexMarketMaking } from "./cexMarketMaking"; // Adjust the path if necessary

dotenv.config();

async function startCEXMarketMakingStrategy() {
    // Get command line arguments
    const args = process.argv.slice(2);

    if (args.length < 7) {
        console.error("Please provide all required arguments: chainID, providerUrl, baseAddress, quoteAddress, referenceCEXBaseTicker, referenceCEXQuoteTicker, fundsHolderAddress");
        console.error("Optional arguments: pollInterval, orderLadderSize, priceStepFactor");
        process.exit(1);
    }

    // Parse arguments
    const chainID = parseInt(args[0], 10);
    const providerUrl = args[1];
    const baseAddress = args[2];
    const quoteAddress = args[3];
    const referenceCEXBaseTicker = args[4];
    const referenceCEXQuoteTicker = args[5];
    const fundsHolderAddress = ethers.utils.getAddress(args[6]);
    const pollInterval = args[7] ? parseInt(args[7], 10) : undefined;
    const orderLadderSize = args[8] ? parseInt(args[8], 10) : undefined;
    const priceStepFactor = args[9] ? parseFloat(args[9]) : undefined;

    // Validate required inputs
    if (isNaN(chainID)) {
        throw new Error("Invalid chainID. Must be a number.");
    }
    if (!ethers.utils.isAddress(baseAddress) || !ethers.utils.isAddress(quoteAddress) || !ethers.utils.isAddress(fundsHolderAddress)) {
        throw new Error("Invalid base, quote, or funds holder address. Must be valid Ethereum addresses.");
    }
    if (!referenceCEXBaseTicker || !referenceCEXQuoteTicker) {
        throw new Error("Reference CEX tickers cannot be empty.");
    }

    // Validate optional inputs if provided
    if (pollInterval !== undefined && isNaN(pollInterval)) {
        throw new Error("Invalid pollInterval. Must be a number.");
    }
    if (orderLadderSize !== undefined && isNaN(orderLadderSize)) {
        throw new Error("Invalid orderLadderSize. Must be a number.");
    }
    if (priceStepFactor !== undefined && isNaN(priceStepFactor)) {
        throw new Error("Invalid priceStepFactor. Must be a number.");
    }

    // Log all configuration values
    console.log("Starting CEX Market Making Strategy with the following configuration:");
    console.log({
        chainID,
        providerUrl,
        baseAddress,
        quoteAddress,
        fundsHolderAddress,
        referenceCEXVenue: "kraken", // This is hardcoded for now
        referenceCEXBaseTicker,
        referenceCEXQuoteTicker,
        pollInterval: pollInterval || "default",
        orderLadderSize: orderLadderSize || "default",
        priceStepFactor: priceStepFactor || "default"
    });

    // Create a new wallet instance
    const provider = new ethers.providers.JsonRpcProvider(providerUrl);

    // User wallet with pk in .env as PRIVATE_KEY
    if (!process.env.PRIVATE_KEY) {
        console.error("Please provide a private key in the .env file");
        process.exit(1);
    }
    const userWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Instantiate the CexMarketMaking strategy
    const strategy = new CexMarketMaking(
        chainID,
        userWallet,
        fundsHolderAddress,
        baseAddress,
        quoteAddress,
        "kraken",
        referenceCEXBaseTicker,
        referenceCEXQuoteTicker,
        pollInterval,
        orderLadderSize,
        priceStepFactor
    );

    // Run the strategy
    strategy.runStrategy();
}

// Start the strategy when the script is executed
startCEXMarketMakingStrategy()
    .then(() => console.log("Strategy finished successfully"))
    .catch((error) => console.error("Error running strategy:", error));
