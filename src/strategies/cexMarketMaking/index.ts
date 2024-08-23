// src/strategies/cexMarketMaking/index.ts
import * as dotenv from "dotenv";

import { ethers } from "ethers";
import { CexMarketMaking } from "./cexMarketMaking"; // Adjust the path if necessary

dotenv.config();

async function startCEXMarketMakingStrategy() {
    // Get command line arguments
    const args = process.argv.slice(2);

    if (args.length < 6) {
        console.error("Please provide all required arguments: chainID, providerUrl, userAddress, baseAddress, quoteAddress, referenceCEXBaseTicker, referenceCEXQuoteTicker");
        process.exit(1);
    }

    // Parse arguments
    const chainID = parseInt(args[0], 10);
    const providerUrl = args[1];
    const userAddress = args[2];
    const baseAddress = args[3];
    const quoteAddress = args[4];
    const referenceCEXBaseTicker = args[5];
    const referenceCEXQuoteTicker = args[6];

    // Set up the ethers provider
    const provider = new ethers.providers.JsonRpcProvider(providerUrl);

    // User wallet with pk in .env as PRIVATE_KEY
    if (!process.env.PRIVATE_KEY) {
        console.error("Please provide a private key in the .env file");
        process.exit(1);
    }
    const userWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    if (userWallet.address.toLowerCase() !== userAddress.toLowerCase()) {
        console.error("Private key does not match provided user address");
        process.exit(1);
    }

    // Instantiate the CexMarketMaking strategy
    const strategy = new CexMarketMaking(
        chainID,
        userWallet,
        userAddress,
        baseAddress,
        quoteAddress,
        "kraken",
        referenceCEXBaseTicker,
        referenceCEXQuoteTicker
    );

    // Run the strategy
    strategy.runStrategy();
}

// Start the strategy when the script is executed
startCEXMarketMakingStrategy()
    .then(() => console.log("Strategy finished successfully"))
    .catch((error) => console.error("Error running strategy:", error));
