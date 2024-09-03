// src/strategies/ammOutBid/index.ts
import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { AMMOutBid } from "./AMMOutBid"; // Adjust the path if necessary
import { Network } from "../../config/tokens";

dotenv.config();

async function startAMMOutBidStrategy() {
    // Get command line arguments
    const args = process.argv.slice(2);

    if (args.length < 5) {
        console.error("Please provide all required arguments");
        process.exit(1);
    }

    // Parse arguments
    const chainID = parseInt(args[0], 10);
    const providerUrl = args[1];
    const baseAddress = args[2];
    const quoteAddress = args[3];
    // const isV2 = args[4].toLowerCase() === "true";
    // const quoterContractAddress = args[5];
    const feeTier = ethers.BigNumber.from(args[4]);

    // Find isv2 and quoter contract based on chainID
    // Configuration for UNI query
    // Mock initialization for demonstration purposes - replace with actual values


    // Set up the ethers provider
    const provider = new ethers.providers.JsonRpcProvider(providerUrl);

    // Instantiate the AMMOutBid strategy
    const strategy = new AMMOutBid(
        chainID,
        provider,
        baseAddress,
        quoteAddress,
        feeTier
    );

    // Log the order book
    await strategy.logOrderBook();
}

// Start the strategy when the script is executed
startAMMOutBidStrategy()
    .then(() => console.log("AMMOutBid strategy finished successfully"))
    .catch((error) => console.error("Error running AMMOutBid strategy:", error));
