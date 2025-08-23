# ODOS Bot - Gladius Order Monitor

The ODOS Bot is a continuous monitoring system that tracks all outstanding Gladius orders on any chain, parsing them into human-readable format and providing real-time updates.

## 🚀 **Features**

- **Continuous Monitoring**: Real-time polling of Gladius orders
- **Human-Readable Parsing**: Converts encoded Dutch orders to readable format
- **Order Classification**: Automatically identifies BIDs vs ASKs
- **Time Tracking**: Shows time remaining until order expiration
- **Token Information**: Displays token symbols and amounts
- **Price Calculation**: Calculates effective prices for all orders
- **Status Monitoring**: Tracks bot health and order counts

## 📋 **Components**

### **1. ODOSBot Class**
The main bot object that handles continuous monitoring and order parsing.

### **2. CLI Scripts**
- `viewGladiusOrders` - View all outstanding orders in real-time
- `botExample` - Example of using the bot programmatically

## 🎯 **Usage**

### **Quick Start - View All Orders**

```bash
# View all outstanding orders on Base (great for RUBI!)
yarn viewGladiusOrders 8453 https://mainnet.base.org

# View orders on Optimism
yarn viewGladiusOrders 10 https://mainnet.optimism.io

# View orders on Ethereum
yarn viewGladiusOrders 1 https://eth.llamarpc.com

# Custom polling interval (5 seconds)
yarn viewGladiusOrders 8453 https://mainnet.base.org 5000
```

### **Programmatic Usage**

```typescript
import { ODOSBot } from './fillers';
import { ethers } from 'ethers';

// Create provider
const provider = new ethers.providers.JsonRpcProvider('YOUR_RPC_URL');

// Create bot instance
const odosBot = new ODOSBot(8453, provider, 10000); // Base chain, 10s polling

// Start monitoring
odosBot.startMonitoring();

// Get all outstanding orders
const orders = await odosBot.getAllOutstandingOrders();

// Display formatted order book
await odosBot.displayAllOutstandingOrders();

// Stop monitoring
odosBot.stopMonitoring();
```

## 📊 **Order Information Displayed**

### **Order Details**
- **Hash**: Order hash (truncated for readability)
- **Type**: BID (buying) or ASK (selling)
- **Token Pair**: Base/Quote token symbols
- **Amounts**: Base and quote amounts in human-readable format
- **Price**: Effective price per base token
- **Owner**: Order creator address
- **Time Remaining**: Countdown to expiration
- **Status**: Active, expired, etc.

### **Order Book Summary**
- Total active orders
- Bid vs Ask counts
- Expired order count
- Last update timestamp

## 🔄 **Continuous Monitoring**

The bot continuously polls the Gladius API to:
- Fetch new orders
- Update existing order statuses
- Remove expired orders
- Maintain real-time order book

### **Polling Intervals**
- **Default**: 10 seconds
- **Customizable**: Set your own interval
- **Real-time**: Orders are fetched immediately when requested

## 🌐 **Supported Chains**

- **Base (8453)**: Great for RUBI tokens!
- **Optimism (10)**: High-performance L2
- **Ethereum (1)**: Mainnet
- **Arbitrum (42161)**: Fast L2
- **Polygon (137)**: Low-cost L2

## 📡 **API Integration**

### **Gladius API**
- Fetches orders from `https://gladius.rubicon.finance`
- Supports pagination and filtering
- Real-time order status updates

### **Dutch Order Parsing**
- Decodes encoded Gladius orders
- Extracts token information and amounts
- Calculates effective prices
- Determines order types (BID/ASK)

## 🛠 **Available Commands**

### **1. View All Orders**
```bash
yarn viewGladiusOrders <chainId> <providerUrl> [pollingInterval]
```

### **2. Run Bot Example**
```bash
yarn run:odosBot <chainId> <providerUrl> [pollingInterval]
```

### **3. Get ODOS Quotes**
```bash
yarn quoteODOSOutput <fromSymbol> <fromAmount> <toSymbol> [chainId]
```

## 📈 **Example Output**

```
📊 GLADIUS ORDER BOOK SUMMARY
================================
🌐 Chain ID: 8453
📅 Last Updated: 12/19/2023, 2:30:45 PM
📈 Total Active Orders: 15
🟢 Bids: 8
🔴 Asks: 7
⏰ Expired: 0

💱 RUBI/DAI
──────────

🟢 BIDS (5):
  1. 10000.000000 RUBI @ 0.000877 DAI
     💰 Total: 8.770535 DAI | ⏰ 2h 15m 30s | 🆔 abc12345...

🔴 ASKS (3):
  1. 5000.000000 RUBI @ 0.000890 DAI
     💰 Total: 4.450000 DAI | ⏰ 1h 45m 12s | 🆔 def67890...
```

## 🔧 **Configuration**

### **Environment Variables**
- No special environment variables required
- Uses default RPC endpoints for each chain

### **Customization**
- Adjustable polling intervals
- Configurable RPC providers
- Extensible order parsing logic

## 💡 **Use Cases**

1. **Market Making**: Monitor order book for opportunities
2. **Arbitrage**: Identify price discrepancies across chains
3. **Liquidity Analysis**: Track order flow and market depth
4. **Trading Bots**: Use as data source for automated trading
5. **Market Research**: Analyze trading patterns and volumes

## 🚨 **Important Notes**

- **Chain Selection Matters**: Different chains have different liquidity and prices
- **Real-time Data**: Orders are fetched live from Gladius API
- **Dutch Auctions**: All orders are Dutch auction format
- **Expiration Handling**: Orders automatically expire and are filtered out
- **Rate Limiting**: Respects API rate limits for sustainable operation

## 🔗 **Integration with ODOS**

The bot includes an ODOS filler instance for:
- Price comparisons between Gladius and ODOS
- Cross-platform arbitrage opportunities
- Market efficiency analysis

## ✨ **Getting Started**

1. **Install dependencies**: `yarn install`
2. **View orders**: `yarn viewGladiusOrders 8453 https://mainnet.base.org`
3. **Customize**: Adjust polling intervals and RPC endpoints
4. **Extend**: Build custom monitoring logic on top of the bot

The ODOS Bot provides a comprehensive view of all Gladius market activity, making it easy to monitor, analyze, and act on trading opportunities! 🎯
