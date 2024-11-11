import { ethers } from "ethers";
import { BondingCurveStrategy } from "./bondingCurve";
import dotenv from "dotenv";

dotenv.config();

async function startBondingCurveStrategy() {
    const args = process.argv.slice(2);

    if (args.length < 5) {
        console.error("Please provide all required arguments: chainID, providerUrl, baseAddress, quoteAddress, userAddress");
        console.error("Optional arguments: pollInterval, orderLadderSize, priceRange, sizeRange");
        process.exit(1);
    }

    // Parse required arguments
    const chainID = parseInt(args[0], 10);
    const providerUrl = args[1];
    const baseAddress = args[2];
    const quoteAddress = args[3];
    const userAddress = args[4];

    // Parse optional arguments
    const pollInterval = args[5] ? parseInt(args[5], 10) : undefined;
    const orderLadderSize = args[6] ? parseInt(args[6], 10) : undefined;
    const priceRange = args[7] ? parseFloat(args[7]) : undefined;
    const sizeRange = args[8] ? parseFloat(args[8]) : undefined;

    // Validate inputs
    if (isNaN(chainID)) {
        throw new Error("Invalid chainID. Must be a number.");
    }
    if (!ethers.utils.isAddress(baseAddress) || !ethers.utils.isAddress(quoteAddress) || !ethers.utils.isAddress(userAddress)) {
        throw new Error("Invalid addresses provided. Must be valid Ethereum addresses.");
    }

    // Set up provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(providerUrl);
    if (!process.env.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY not found in environment variables");
    }
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Log configuration
    console.log("Starting Bonding Curve Strategy with configuration:", {
        chainID,
        baseAddress,
        quoteAddress,
        userAddress,
        pollInterval: pollInterval || "default (5000)",
        orderLadderSize: orderLadderSize || "default (5)",
        priceRange: priceRange || "default (6)",
        sizeRange: sizeRange || "default (12)"
    });

    // Initialize strategy
    const strategy = new BondingCurveStrategy(
        chainID,
        wallet,
        userAddress,
        baseAddress,
        quoteAddress,
        pollInterval,
        orderLadderSize,
        priceRange,
        sizeRange
    );

    await strategy.runStrategy();
}

// Execute strategy
startBondingCurveStrategy().catch((error) => {
    console.error("Error running bonding curve strategy:", error);
    process.exit(1);
});
