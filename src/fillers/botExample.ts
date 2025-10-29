// src/fillers/botExample.ts
import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { ODOSBot } from "./odosBot";

dotenv.config();

async function runODOSBotExample() {
    // Get command line arguments
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error("Please provide all required arguments: chainID, providerUrl");
        console.error("Example: ts-node src/fillers/botExample.ts 8453 https://mainnet.base.org");
        console.error("Optional arguments: pollingInterval");
        process.exit(1);
    }

    // Parse arguments
    const chainID = parseInt(args[0], 10);
    const providerUrl = args[1];
    const pollingInterval = args[2] ? parseInt(args[2], 10) : 10000;

    // Validate required inputs
    if (isNaN(chainID)) {
        throw new Error("Invalid chainID. Must be a number.");
    }

    console.log("Starting ODOS Bot Example with the following configuration:");
    console.log({
        chainID,
        providerUrl,
        pollingInterval
    });

    try {
        // Create provider
        const provider = new ethers.providers.JsonRpcProvider(providerUrl);

        // Create ODOS Bot instance
        const odosBot = new ODOSBot(chainID, provider, pollingInterval);

        console.log("\n=== ODOS Bot Example ===");
        console.log(`Chain ID: ${chainID}`);
        console.log(`Polling Interval: ${pollingInterval}ms`);

        // Start monitoring
        console.log("\n🚀 Starting order monitoring...");
        odosBot.startMonitoring();

        // Wait for initial fetch
        console.log("⏳ Waiting for initial order fetch...");
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Get order book summary
        console.log("\n📊 Getting order book summary...");
        const summary = await odosBot.getOrderBookSummary();
        console.log("Order Book Summary:", summary);

        // Get all outstanding orders
        console.log("\n📋 Getting all outstanding orders...");
        const allOrders = await odosBot.getAllOutstandingOrders();
        console.log(`Total outstanding orders: ${allOrders.length}`);

        // Display orders by type
        if (allOrders.length > 0) {
            const bids = await odosBot.getOrdersByType('BID');
            const asks = await odosBot.getOrdersByType('ASK');
            
            console.log(`\n🟢 Bids: ${bids.length}`);
            console.log(`🔴 Asks: ${asks.length}`);

            // Show first few orders of each type
            if (bids.length > 0) {
                console.log("\n🟢 Sample Bids:");
                bids.slice(0, 3).forEach((order, index) => {
                    console.log(`  ${index + 1}. ${order.baseAmount.toFixed(6)} ${order.baseToken} @ ${order.price.toFixed(6)} ${order.quoteToken}`);
                    console.log(`     💰 Total: ${order.quoteAmount.toFixed(6)} ${order.quoteToken} | ⏰ ${order.timeRemaining}`);
                });
            }

            if (asks.length > 0) {
                console.log("\n🔴 Sample Asks:");
                asks.slice(0, 3).forEach((order, index) => {
                    console.log(`  ${index + 1}. ${order.baseAmount.toFixed(6)} ${order.baseToken} @ ${order.price.toFixed(6)} ${order.quoteToken}`);
                    console.log(`     💰 Total: ${order.quoteAmount.toFixed(6)} ${order.quoteToken} | ⏰ ${order.timeRemaining}`);
                });
            }
        }

        // Get bot status
        console.log("\n📈 Bot Status:");
        const status = odosBot.getStatus();
        console.log(status);

        // Display all orders in formatted view
        console.log("\n📊 Displaying all orders in formatted view...");
        await odosBot.displayAllOutstandingOrders();

        // Keep the bot running for a bit to show continuous monitoring
        console.log("\n🔄 Bot will continue monitoring for 30 seconds...");
        console.log("Press Ctrl+C to stop early");
        
        await new Promise(resolve => setTimeout(resolve, 30000));

        // Stop monitoring
        console.log("\n⏹️ Stopping bot monitoring...");
        odosBot.stopMonitoring();

        console.log("\n=== Example completed successfully! ===");

    } catch (error) {
        console.error("Error running ODOS bot example:", error);
        process.exit(1);
    }
}

// Start the example when the script is executed
runODOSBotExample()
    .then(() => console.log("Example finished successfully"))
    .catch((error) => console.error("Error running example:", error));
