# ODOS Filler v3

The ODOS Filler provides a comprehensive interface to interact with the ODOS (One-Click DEX Order System) v3 API for token swaps and price discovery.

## Features

- **Token Quotes**: Get detailed quotes for token swaps including amounts, gas estimates, and price impact
- **Price Discovery**: Retrieve current token prices, bid/ask spreads, and mid-point prices
- **Swap Transactions**: Generate swap transaction data for execution
- **Gas Estimation**: Get gas estimates, gas prices, and USD values for swaps
- **Price Impact Analysis**: Monitor price impact and percent difference of trades
- **Token Information**: Access token metadata and formatting utilities
- **Chain Information**: Get supported chains and liquidity sources
- **Advanced Analytics**: Access to permit2 messages, path visualization, and more

## ODOS v3 API Features

The filler now uses ODOS v3 API which provides:
- **Enhanced Gas Data**: Gas price in gwei, USD value of gas estimates
- **Better Price Analysis**: Percent difference between input/output values
- **Advanced Routing**: Improved path finding with source whitelist/blacklist
- **Permit2 Support**: Built-in permit2 message generation
- **Path Visualization**: Optional path visualization images
- **Rate Limiting**: Better API rate limiting and reliability

## Usage

### Basic Setup

```typescript
import { ODOSFiller } from './fillers';
import { ethers } from 'ethers';

// Create a provider
const provider = new ethers.providers.JsonRpcProvider('YOUR_RPC_URL');

// Initialize the filler
const odosFiller = new ODOSFiller(10, provider); // 10 = Optimism Mainnet
```

### Getting a Quote (v3)

```typescript
// Get a quote for swapping 1 WETH to USDC
const quote = await odosFiller.getQuote(
    '0x4200000000000000000000000000000000000006', // WETH on Optimism
    '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC on Optimism
    '1' // Amount to swap
);

console.log(`Input: ${quote.inAmounts[0]}`);
console.log(`Output: ${quote.outAmounts[0]}`);
console.log(`Gas Estimate: ${quote.gasEstimate}`);
console.log(`Gas Price: ${quote.gweiPerGas} gwei`);
console.log(`Gas Estimate Value: $${quote.gasEstimateValue} USD`);
console.log(`Price Impact: ${quote.priceImpact}%`);
console.log(`Percent Diff: ${quote.percentDiff}%`);
console.log(`Net Out Value: $${quote.netOutValue} USD`);
```

### Getting Token Prices

```typescript
// Get the current price of WETH in USDC
const price = await odosFiller.getTokenPrice(
    '0x4200000000000000000000000000000000000006', // WETH
    '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC
    '1' // Amount
);

console.log(`1 WETH = ${price} USDC`);
```

### Getting Bid/Ask Spreads

```typescript
// Get best bid and ask prices
const { bid, ask } = await odosFiller.getBestBidAndAsk(
    '0x4200000000000000000000000000000000000006', // WETH
    '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC
    '1' // Amount
);

console.log(`Best Bid: ${bid} USDC per WETH`);
console.log(`Best Ask: ${ask} USDC per WETH`);
```

### Getting Swap Transactions

```typescript
// Get a swap transaction for execution
const swapTx = await odosFiller.getSwapTransaction(
    '0x4200000000000000000000000000000000000006', // WETH
    '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC
    '1', // Amount
    '0xYourWalletAddress' // User address
);

console.log(`To: ${swapTx.tx.to}`);
console.log(`Data: ${swapTx.tx.data}`);
console.log(`Value: ${swapTx.tx.value}`);
console.log(`Gas: ${swapTx.tx.gas}`);
```

### Advanced Gas Information

```typescript
// Get detailed gas information
const gasPrice = await odosFiller.getGasPrice(baseToken, quoteToken, amount);
const gasEstimateValue = await odosFiller.getGasEstimateValue(baseToken, quoteToken, amount);

console.log(`Gas Price: ${gasPrice} gwei`);
console.log(`Gas Estimate Value: $${gasEstimateValue} USD`);
```

### Chain and Liquidity Information

```typescript
// Get supported chains
const supportedChains = await odosFiller.getSupportedChains();
console.log(`Supported chains: ${supportedChains.length}`);

// Get liquidity sources for a specific chain
const liquiditySources = await odosFiller.getLiquiditySources(10); // Optimism
console.log(`Liquidity sources on Optimism: ${liquiditySources.length}`);
```

## Running the Example

Use the provided example script to test the ODOS filler v3:

```bash
# Run with ts-node
ts-node src/fillers/example.ts <chainID> <providerUrl> <baseTokenAddress> <quoteTokenAddress> [amount]

# Example for Optimism Mainnet (WETH to USDC)
ts-node src/fillers/example.ts 10 https://mainnet.optimism.io 0x4200000000000000000000000000000000000006 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85 1

# Example for Arbitrum Mainnet (WETH to USDC)
ts-node src/fillers/example.ts 42161 https://arb1.arbitrum.io/rpc 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 1
```

## Supported Chains

The ODOS filler v3 supports multiple chains including:
- Ethereum Mainnet (1)
- Optimism Mainnet (10)
- Arbitrum Mainnet (42161)
- Base Mainnet (8453)
- Polygon Mainnet (137)
- And more...

## API Endpoints

The filler interacts with the following ODOS v3 API endpoints:
- **Quote**: `https://api.odos.xyz/sor/quote/v3` - Get swap quotes with enhanced data
- **Assemble**: `https://api.odos.xyz/sor/assemble` - Generate swap transactions
- **Tokens**: `https://api.odos.xyz/info/tokens/{chainId}` - Get supported tokens
- **Chains**: `https://api.odos.xyz/info/chains` - Get supported chains
- **Liquidity Sources**: `https://api.odos.xyz/info/liquidity-sources/{chainId}` - Get liquidity sources

## Error Handling

The filler includes comprehensive error handling for:
- Invalid token addresses
- Network errors
- API rate limits
- Insufficient liquidity
- Invalid chain IDs
- Deprecated API usage warnings

## Dependencies

- `ethers` - Ethereum library for providers and utilities
- `axios` - HTTP client for API requests
- `@uniswap/token-lists` - Token information utilities

## Notes

- All amounts are handled in human-readable format (e.g., "1.5" for 1.5 tokens)
- The filler automatically handles token decimals for proper formatting
- Price impact, gas estimates, and percent differences are provided by the ODOS v3 API
- The filler integrates with the existing token configuration in the codebase
- RFQs are disabled by default for better reliability
- Compact call data is used by default for efficient transactions
- Slippage is set to 0.5% by default for quotes
