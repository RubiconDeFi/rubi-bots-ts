import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { AMMOutBid } from "./ammOutbid"; // Adjust the path if necessary

// src/strategies/ammOutBid/index.ts

dotenv.config();

async function startAMMOutBidStrategy() {
    // Get command line arguments
    const args = process.argv.slice(2);

    if (args.length < 5) {
        console.error("Please provide all required arguments: chainID, providerUrl, baseAddress, quoteAddress, feeTier, fundsHolderAddress");
        process.exit(1);
    }

    // Parse arguments
    const chainID = parseInt(args[0], 10);
    const providerUrl = args[1];
    const baseAddress = args[2];
    const quoteAddress = args[3];
    const feeTier = ethers.BigNumber.from(args[4]);
    const fundsHolderAddress = ethers.utils.getAddress(args[5]);

    // Check if optional arguments exist
    const orderLadderLength = args[6] ? parseInt(args[6], 10) : undefined;
    const priceLadderFactor = args[7] ? parseFloat(args[7]) : undefined;
    const pollInterval = args[8] ? parseInt(args[8], 10) : 5000;
    const isUniv2 = args[9] ? args[9].toLowerCase() === "true" : undefined;

    // Set up the ethers provider
    const provider = new ethers.providers.JsonRpcProvider(providerUrl);

    // User wallet with pk in .env as PRIVATE_KEY
    if (!process.env.PRIVATE_KEY) {
        console.error("Please provide a private key in the .env file");
        process.exit(1);
    }
    const userWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Instantiate the AMMOutBid strategy
    const strategy = new AMMOutBid(
        chainID,
        userWallet,
        fundsHolderAddress,
        baseAddress,
        quoteAddress,
        feeTier,
        pollInterval,
        orderLadderLength,
        priceLadderFactor,
        isUniv2
    );

    // Run the strategy
    strategy.runStrategy();
}

// Start the strategy when the script is executed
startAMMOutBidStrategy()
    .then(() => console.log("AMMOutBid strategy finished successfully"))
    .catch((error) => console.error("Error running AMMOutBid strategy:", error));
