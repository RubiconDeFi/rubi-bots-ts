# **Strategies**

The **strategies** folder contains the core trading logic for Rubicon bots. These strategies combine market data from external exchanges (via **referenceVenues**) and execute trades or market-making strategies on Rubicon using **connectors**.

### Overview
Each strategy defines a specific trading behavior. It takes market data from **referenceVenues** (such as Kraken or ODOS) and uses the functions provided by **connectors** to place, edit, or cancel orders on Rubicon. 

Some strategies are designed to help the community and provide opportunities to earn points or tokens by contributing. Feel free to contribute PRs with strategies that can benefit others!

### **Running Strategies**

To run a strategy, you need to set up the required parameters and environment variables. Here's an example of how to run the `cexMarketMaking` strategy.

#### **Running `cexMarketMaking` Strategy**

Here's an example of running the `cexMarketMaking` strategy:

```bash
yarn run:cexMarketMaking 10 RPC_URL ADDRESS 0x4200000000000000000000000000000000000006 0x7F5c764cBc14f9669B88837ca1490cCa17c31607 ETH USD
```
In this example:

- 10: This is an example parameter that might represent the chain ID (e.g., 10 for Optimism).
- RPC_URL: The URL of the blockchain's RPC node.
- ADDRESS: Your wallet address that will be used to execute the strategy.
- 0x4200000000000000000000000000000000000006: The base token address (in this case, WETH on Optimism).
- 0x7F5c764cBc14f9669B88837ca1490cCa17c31607: The quote token address (in this case, USDC.e on Optimism).
- ETH: The base ticker symbol for the reference venue (e.g., Kraken).
- USD: The quote ticker symbol for the reference venue (e.g., Kraken).

### Environment Setup
To run the strategies successfully, ensure you have a .env file in the root of the repository with the following setup:

```env
PRIVATE_KEY=your_private_key_here
```
This private key will be used to sign and send transactions from your wallet. Never commit this key to Github.

### Contributing Strategies
We encourage the community to contribute strategies that can benefit others! You can submit a PR with your strategy and describe how it works, including examples of how to run it.

By contributing, you can earn points or tokens for your efforts, depending on the value and impact of the strategy. Join the community and help expand the repository with more innovative trading logic!