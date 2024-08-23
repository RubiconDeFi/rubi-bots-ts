# **RUBI-BOTS-TS**
Example bot implementations for Rubicon Gladius (v4) in Typescript.

## Overview
This repository provides a framework for building, executing, and extending trading bots designed for the Rubicon protocol using the Gladius (v4) SDK. Written in TypeScript, the bots are modular and can be adapted for different strategies, connectors, and reference venues.

### **Core Components:**

1. **Strategies**
   - Strategies define and execute trading algorithms. These can vary from basic market making to more sophisticated arbitrage strategies. Example strategies include `ammOutbid` and `cexMarketMaking`.
   - Each strategy can be run independently, and detailed usage examples are provided in the `strategies/README.md`.

2. **Connectors**
   - Connectors interface with exchanges, manage liquidity, place, cancel, and edit orders.
   - Example connectors include `rubicon.ts`, which connects to Rubicon, providing a variety of functions necessary for managing orders and executing trades.

3. **Reference Venues**
   - Reference Venues are sources of price data from external exchanges. These parsed order books fuel the strategies by providing market context and liquidity information.
   - Examples include `kraken.ts`, which connects to Kraken for market data, and `odos.ts` for other reference venues.

### **Folder Structure:**

- **src/config**  
  Configuration files for tokens and exchange-specific settings.
  
- **src/connectors**  
  Contains connectors to various exchanges such as Rubicon.
  
- **src/referenceVenues**  
  Parsed order books from different venues such as Kraken and ODOS.
  
- **src/strategies**  
  Strategies implementing different trading logic using connectors and reference venues.
  
- **src/types**  
  TypeScript definitions for the core data structures used across the project.

- **src/tests**  
  Testing framework with unit and integration tests for each strategy and connector.

### **Running Strategies**

Detailed instructions on how to run the different strategies can be found in the `strategies/README.md`. Each strategy is configured to connect to the necessary exchanges, execute the trading logic, and handle live updates of market data.

### **Contributing & Issues**

If you encounter any issues, have suggestions for improvements, or would like to see new features added, feel free to open an issue in this repository. Contributions and feedback are always welcome!

## Cloud Configuration

Rubi Bots are best run in the cloud to earn for you while you sleep. Here is an example of a simple way you could do this with Heroku.

1. Make a private fork of this repo.
2. Add a `Procfile` in the root of the repo (your fork).
3. Configure your strategy and add it to the Procfile.
4. Add a new Heroku app which automatically builds off of your private fork of this repo.
5. Configure necessary `.env` variables in the Heroku app settings
6. Launch the bot through Heroku Resources
