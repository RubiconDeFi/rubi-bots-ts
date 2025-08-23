#!/usr/bin/env ts-node
// src/fillers/findArbitrage.ts
import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { ODOSBot } from "./odosBot";

dotenv.config();

async function findArbitrageOpportunities() {
    // Get command line arguments
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log(`\n💰 GLADIUS-ODOS ARBITRAGE FINDER`);
        console.log(`\nUsage:`);
        console.log(`  yarn findArbitrage <chainId> <providerUrl>`);
        console.log(`\nExamples:`);
        console.log(`  yarn findArbitrage 8453 https://mainnet.base.org`);
        console.log(`  yarn findArbitrage 10 https://mainnet.optimism.io`);
        console.log(`\nArguments:`);
        console.log(`  chainId     - Chain ID to monitor (e.g., 8453 for Base, 10 for Optimism)`);
        console.log(`  providerUrl - RPC provider URL for the chain`);
        console.log(`\nWhat this does:`);
        console.log(`  1. Fetches all outstanding Gladius orders`);
        console.log(`  2. Queries ODOS for reverse trades`);
        console.log(`  3. Identifies profitable arbitrage opportunities`);
        console.log(`  4. Shows potential profits and gas costs`);
        process.exit(1);
    }

    // Parse arguments
    const chainId = parseInt(args[0], 10);
    const providerUrl = args[1];

    // Validate inputs
    if (isNaN(chainId)) {
        console.error(`❌ Invalid chain ID: "${args[0]}". Must be a number.`);
        process.exit(1);
    }

    console.log(`\n💰 GLADIUS-ODOS ARBITRAGE FINDER v1.0`);
    console.log(`Searching for opportunities on Chain ID: ${chainId}`);
    console.log(`Provider: ${providerUrl}`);
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
        const odosBot = new ODOSBot(chainId, provider, 30000); // 30 second polling for this script
        
        console.log(`\n📡 Fetching Gladius orders...`);
        
        // Get all outstanding orders
        const orders = await odosBot.getAllOutstandingOrders();
        console.log(`📊 Found ${orders.length} outstanding orders`);
        
        if (orders.length === 0) {
            console.log(`\n❌ No outstanding orders found. Nothing to analyze.`);
            process.exit(0);
        }
        
        // Display order summary
        console.log(`\n📋 ORDER SUMMARY:`);
        const bids = orders.filter(o => o.type === 'BID').length;
        const asks = orders.filter(o => o.type === 'ASK').length;
        console.log(`  🟢 Bids: ${bids}`);
        console.log(`  🔴 Asks: ${asks}`);
        
        // Find arbitrage opportunities
        console.log(`\n🔍 Analyzing arbitrage opportunities...`);
        console.log(`This may take a moment as we query ODOS for each order...`);
        
        const opportunities = await odosBot.findArbitrageOpportunities();
        
        // Display results
        if (opportunities.length > 0) {
            console.log(`\n🎯 ARBITRAGE ANALYSIS COMPLETE!`);
            await odosBot.displayArbitrageOpportunities();
            
            // Summary
            const profitableOpps = opportunities.filter(opp => opp.netProfit > 0);
            const totalNetProfit = opportunities.reduce((sum, opp) => sum + opp.netProfit, 0);
            
            console.log(`\n📊 FINAL SUMMARY:`);
            console.log(`  🎯 Total Opportunities: ${opportunities.length}`);
            console.log(`  💰 Profitable Opportunities: ${profitableOpps.length}`);
            console.log(`  🎯 Total Net Profit: $${totalNetProfit.toFixed(4)} USD`);
            
            if (profitableOpps.length > 0) {
                console.log(`\n🚀 PROFITABLE OPPORTUNITIES FOUND!`);
                console.log(`Consider executing these trades for profit!`);
            }
            
        } else {
            console.log(`\n❌ No profitable arbitrage opportunities found.`);
            console.log(`This could mean:`);
            console.log(`  • Markets are efficient (no price discrepancies)`);
            console.log(`  • Gas costs exceed potential profits`);
            console.log(`  • Orders are not profitable to fill`);
        }
        
        console.log(`\n✨ Arbitrage analysis completed!`);
        
    } catch (error) {
        console.error(`\n❌ Error during arbitrage analysis:`, error);
        if (error instanceof Error) {
            console.error(`   Message: ${error.message}`);
        }
        process.exit(1);
    }
}

// Run the arbitrage finder
findArbitrageOpportunities()
    .then(() => {
        console.log(`\n🎯 Arbitrage finder completed successfully`);
    })
    .catch((error) => {
        console.error(`\n💥 Fatal error:`, error);
        process.exit(1);
    });
