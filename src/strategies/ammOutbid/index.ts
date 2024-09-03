import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { AMMOutBid } from "./AMMOutBid"; // Adjust the path if necessary

// src/strategies/ammOutBid/index.ts

dotenv.config();

async function startAMMOutBidStrategy() {
    // Get command line arguments
    const args = process.argv.slice(2);

    if (args.length < 4) {
        console.error("Please provide all required arguments: chainID, providerUrl, baseAddress, quoteAddress, feeTier");
        process.exit(1);
    }

    // Parse arguments
    const chainID = parseInt(args[0], 10);
    const providerUrl = args[1];
    const baseAddress = args[2];
    const quoteAddress = args[3];
    const feeTier = ethers.BigNumber.from(args[4]);

    // Check if optional arguments exist
    const orderLadderLength = args[5] ? parseInt(args[5], 10) : undefined;
    const priceLadderFactor = args[6] ? parseFloat(args[6]) : undefined;
    const pollInterval = args[7] ? parseInt(args[7], 10) : 5000;

    // Set up the ethers provider
    const provider = new ethers.providers.JsonRpcProvider(providerUrl);

    // User wallet with pk in .env as PRIVATE_KEY
    if (!process.env.PRIVATE_KEY) {
        console.error("Please provide a private key in the .env file");
        process.exit(1);
    }
    const userWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const userAddress = userWallet.address;

    // Instantiate the AMMOutBid strategy
    const strategy = new AMMOutBid(
        chainID,
        userWallet,
        userAddress,
        baseAddress,
        quoteAddress,
        feeTier,
        pollInterval,
        orderLadderLength,
        priceLadderFactor
    );

    // Run the strategy
    strategy.runStrategy();
}

// Start the strategy when the script is executed
startAMMOutBidStrategy()
    .then(() => console.log("AMMOutBid strategy finished successfully"))
    .catch((error) => console.error("Error running AMMOutBid strategy:", error));
