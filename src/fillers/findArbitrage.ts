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
        console.log(`  5. 🆕 Calculates real-time Dutch auction decay prices`);
        console.log(`  6. 🆕 Compares decayed prices vs ODOS for arbitrage`);
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

    console.log(`\n💰 GLADIUS-ODOS ARBITRAGE FINDER v2.0`);
    console.log(`🔴 DUTCH AUCTION DECAY PRICING ENABLED`);
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
        console.log(`🔄 Processing Dutch auction decay calculations...`);
        
        // Get all outstanding orders
        const orders = await odosBot.getAllOutstandingOrders();
        console.log(`📊 Found ${orders.length} outstanding orders`);
        
        if (orders.length === 0) {
            console.log(`\n❌ No outstanding orders found. Nothing to analyze.`);
            process.exit(0);
        }
        
        // Display order summary with Dutch auction info
        console.log(`\n📋 ORDER SUMMARY:`);
        const bids = orders.filter(o => o.type === 'BID').length;
        const asks = orders.filter(o => o.type === 'ASK').length;
        const dutchOrders = orders.filter(o => o.isDutchOrder).length;
        const regularOrders = orders.length - dutchOrders;
        
        console.log(`  🟢 Bids: ${bids}`);
        console.log(`  🔴 Asks: ${asks}`);
        console.log(`  🕐 Dutch Auctions: ${dutchOrders} (with real-time decay pricing)`);
        console.log(`  📊 Regular Orders: ${regularOrders}`);
        
        if (dutchOrders > 0) {
            console.log(`\n🕐 DUTCH AUCTION DECAY ANALYSIS:`);
            console.log(`  • Dutch orders automatically decay from start price → end price`);
            console.log(`  • Current prices calculated using linear interpolation`);
            console.log(`  • Decay timing: ${orders[0]?.decayStartTime ? 'Based on order creation time' : 'Default 1-hour decay'}`);
            console.log(`  • Real-time pricing ensures accurate arbitrage calculations`);
        }
        
        // Find arbitrage opportunities
        console.log(`\n🔍 Analyzing arbitrage opportunities...`);
        console.log(`This may take a moment as we query ODOS for each order...`);
        console.log(`🔄 Dutch auction prices are calculated in real-time for accurate comparison`);
        
        const opportunities = await odosBot.findArbitrageOpportunities();
        
        // Display results
        if (opportunities.length > 0) {
            console.log(`\n🎯 ARBITRAGE ANALYSIS COMPLETE!`);
            await odosBot.displayArbitrageOpportunities();
            
            // Summary with Dutch auction breakdown
            const profitableOpps = opportunities.filter(opp => opp.netProfit > 0);
            const totalNetProfit = opportunities.reduce((sum, opp) => sum + opp.netProfit, 0);
            const dutchOpportunities = opportunities.filter(opp => opp.gladiusOrder.isDutchOrder);
            const regularOpportunities = opportunities.filter(opp => !opp.gladiusOrder.isDutchOrder);
            
            console.log(`\n📊 FINAL SUMMARY:`);
            console.log(`  🎯 Total Opportunities: ${opportunities.length}`);
            console.log(`  💰 Profitable Opportunities: ${profitableOpps.length}`);
            console.log(`  🎯 Total Net Profit: $${totalNetProfit.toFixed(4)} USD`);
            
            if (dutchOrders > 0) {
                console.log(`\n🕐 DUTCH AUCTION BREAKDOWN:`);
                console.log(`  🕐 Dutch Auction Opportunities: ${dutchOpportunities.length}`);
                console.log(`  📊 Regular Order Opportunities: ${regularOpportunities.length}`);
                console.log(`  💡 Dutch auctions may offer better prices due to decay!`);
            }
            
            if (profitableOpps.length > 0) {
                console.log(`\n🚀 PROFITABLE OPPORTUNITIES FOUND!`);
                console.log(`Consider executing these trades for profit!`);
                
                // Highlight Dutch auction opportunities
                const profitableDutch = profitableOpps.filter(opp => opp.gladiusOrder.isDutchOrder);
                if (profitableDutch.length > 0) {
                    console.log(`\n🕐 DUTCH AUCTION PROFIT HIGHLIGHTS:`);
                    console.log(`  • ${profitableDutch.length} profitable Dutch auction opportunities`);
                    console.log(`  • Dutch orders may have better prices due to time decay`);
                    console.log(`  • Act quickly - prices continue to decay!`);
                }
            }
            
        } else {
            console.log(`\n❌ No profitable arbitrage opportunities found.`);
            console.log(`This could mean:`);
            console.log(`  • Markets are efficient (no price discrepancies)`);
            console.log(`  • Gas costs exceed potential profits`);
            console.log(`  • Orders are not profitable to fill`);
            console.log(`  • Dutch auction decay hasn't created profitable opportunities yet`);
        }
        
        console.log(`\n✨ Arbitrage analysis completed!`);
        console.log(`🕐 Remember: Dutch auction prices decay in real-time!`);
        
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
