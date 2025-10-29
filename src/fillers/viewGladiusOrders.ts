#!/usr/bin/env ts-node
// src/fillers/viewGladiusOrders.ts
import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { ODOSBot } from "./odosBot";

dotenv.config();

async function viewGladiusOrders() {
    // Get command line arguments
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log(`\n📊 GLADIUS ORDER VIEWER - View all outstanding orders on any chain`);
        console.log(`\nUsage:`);
        console.log(`  yarn viewGladiusOrders <chainId> <providerUrl> [pollingInterval]`);
        console.log(`\nExamples:`);
        console.log(`  yarn viewGladiusOrders 8453 https://mainnet.base.org`);
        console.log(`  yarn viewGladiusOrders 10 https://mainnet.optimism.io`);
        console.log(`  yarn viewGladiusOrders 1 https://eth.llamarpc.com 5000`);
        console.log(`\nArguments:`);
        console.log(`  chainId         - Chain ID to monitor (e.g., 8453 for Base, 10 for Optimism)`);
        console.log(`  providerUrl     - RPC provider URL for the chain`);
        console.log(`  pollingInterval - Optional: Polling interval in milliseconds (default: 10000)`);
        console.log(`\nPopular chains:`);
        console.log(`  8453  - Base Mainnet (Great for RUBI!)`);
        console.log(`  10    - Optimism Mainnet`);
        console.log(`  1     - Ethereum Mainnet`);
        console.log(`  137   - Polygon Mainnet`);
        console.log(`  42161 - Arbitrum Mainnet`);
        process.exit(1);
    }

    // Parse arguments
    const chainId = parseInt(args[0], 10);
    const providerUrl = args[1];
    const pollingInterval = args[2] ? parseInt(args[2], 10) : 10000;

    // Validate inputs
    if (isNaN(chainId)) {
        console.error(`❌ Invalid chain ID: "${args[0]}". Must be a number.`);
        process.exit(1);
    }

    if (isNaN(pollingInterval)) {
        console.error(`❌ Invalid polling interval: "${args[2]}". Must be a number.`);
        process.exit(1);
    }

    console.log(`\n🚀 GLADIUS ORDER VIEWER v1.0`);
    console.log(`Monitoring orders on Chain ID: ${chainId}`);
    console.log(`Provider: ${providerUrl}`);
    console.log(`Polling Interval: ${pollingInterval}ms (${pollingInterval / 1000}s)`);
    console.log(`\n⏳ Initializing...`);

    try {
        // Create provider
        const provider = new ethers.providers.JsonRpcProvider(providerUrl);
        
        // Test provider connection
        const network = await provider.getNetwork();
        console.log(`✅ Connected to ${network.name} (Chain ID: ${network.chainId})`);
        
        if (network.chainId !== chainId) {
            console.warn(`⚠️  Warning: Provider chain ID (${network.chainId}) doesn't match requested chain ID (${chainId})`);
        }

        // Create ODOS Bot instance
        const odosBot = new ODOSBot(chainId, provider, pollingInterval);
        
        console.log(`\n📡 Starting order monitoring...`);
        
        // Start monitoring
        odosBot.startMonitoring();
        
        // Wait a moment for initial fetch
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Display all outstanding orders
        console.log(`\n📊 Fetching current order book...`);
        await odosBot.displayAllOutstandingOrders();
        
        // Find arbitrage opportunities
        console.log(`\n🔍 Searching for arbitrage opportunities...`);
        await odosBot.findArbitrageOpportunities();
        await odosBot.displayArbitrageOpportunities();
        
        // Show status
        const status = odosBot.getStatus();
        console.log(`\n📈 BOT STATUS:`);
        console.log(`  🔄 Monitoring: ${status.isPolling ? '✅ Active' : '❌ Inactive'}`);
        console.log(`  🌐 Chain ID: ${status.chainId}`);
        console.log(`  📅 Last Update: ${new Date(status.lastUpdate).toLocaleString()}`);
        console.log(`  📊 Order Count: ${status.orderCount}`);
        console.log(`  💰 Arbitrage Opportunities: ${status.arbitrageOpportunities}`);
        
        // Set up continuous monitoring
        console.log(`\n🔄 Continuous monitoring active. Press Ctrl+C to stop.`);
        console.log(`📊 Orders will be updated every ${pollingInterval / 1000} seconds.`);
        console.log(`🔍 Arbitrage analysis will run with each update.`);
        
        // Keep the process running and show updates
        setInterval(async () => {
            if (status.isPolling) {
                const currentStatus = odosBot.getStatus();
                if (currentStatus.lastUpdate > status.lastUpdate) {
                    console.log(`\n🔄 Order book updated at ${new Date(currentStatus.lastUpdate).toLocaleTimeString()}`);
                    console.log(`📊 Current order count: ${currentStatus.orderCount}`);
                    
                    // Update status
                    Object.assign(status, currentStatus);
                    
                    // Re-run arbitrage analysis
                    console.log(`\n🔍 Re-analyzing arbitrage opportunities...`);
                    await odosBot.findArbitrageOpportunities();
                    await odosBot.displayArbitrageOpportunities();
                }
            }
        }, 5000); // Check for updates every 5 seconds
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log(`\n\n⏹️  Shutting down gracefully...`);
            odosBot.stopMonitoring();
            console.log(`✨ Goodbye!`);
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            console.log(`\n\n⏹️  Received termination signal...`);
            odosBot.stopMonitoring();
            console.log(`✨ Goodbye!`);
            process.exit(0);
        });
        
    } catch (error) {
        console.error(`\n❌ Error initializing GLADIUS order viewer:`, error);
        if (error instanceof Error) {
            console.error(`   Message: ${error.message}`);
        }
        process.exit(1);
    }
}

// Run the viewer
viewGladiusOrders()
    .then(() => {
        // Keep the process running
        console.log(`\n🔄 Order viewer is running...`);
    })
    .catch((error) => {
        console.error(`\n💥 Fatal error:`, error);
        process.exit(1);
    });
