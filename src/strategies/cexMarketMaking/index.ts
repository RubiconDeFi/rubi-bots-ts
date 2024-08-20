// src/strategies/cexMarketMaking/index.ts
import { ethers } from "ethers";
import { CexMarketMaking } from "./cexMarketMaking"; // Adjust the path if necessary

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

    // Instantiate the CexMarketMaking strategy
    const strategy = new CexMarketMaking(
        chainID,
        provider,
        userAddress,
        baseAddress,
        quoteAddress,
        true,
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
