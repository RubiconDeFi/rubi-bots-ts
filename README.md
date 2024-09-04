# **RUBI-BOTS-TS**
Example bot implementations for Rubicon Gladius (v4) in Typescript. **This repository in an onging work in progress that will be developed and maintained by Rubicon and its community. Use at your own risk. [Terms of Use apply](https://rubicon.finance/terms).**

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

Rubi Bots are best run in the cloud to earn for you while you sleep. Below is a guide on how to set up the bot using Heroku. For **privacy and security**, it's highly recommended that you use a **private fork** of this repository, especially if you plan to add sensitive configuration files or environment variables such as API keys.

### Public vs Private Forks

- **Public Fork**: The instructions below are suitable for a public fork of this repository. However, **be very cautious**: if your `Procfile` or configuration files contain sensitive information such as API keys, **you should not use a public fork**. This could expose your keys to the public and result in security issues.
  
- **Private Fork**: It’s strongly recommended to keep a **private fork** of this repository to ensure sensitive information like API keys or strategy configurations remain secure. Below are instructions on how to create and maintain a private fork that works seamlessly with Heroku.

### Instructions for Private Fork (Recommended)

1. **Make a private fork** of this repository:
   - Since GitHub does not directly support creating private forks of public repositories, you can achieve this by:
     1. Cloning this public repository to your local machine:
        ```bash
        git clone https://github.com/RubiconDeFi/rubi-bots-ts.git
        ```
     2. Creating a new **private repository** in your GitHub account.
     3. Pushing your local copy to the new private repository:
        ```bash
        git remote set-url origin https://github.com/your-username/rubi-bots-ts-private.git
        git push -u origin main
        ```

   - **Maintaining updates from the public repository**: After you have your private fork, you can keep it updated with changes from the original public repository by setting the public repository as an upstream remote:
     ```bash
     git remote add upstream https://github.com/RubiconDeFi/rubi-bots-ts.git
     ```
     - To fetch and merge updates from the public repository, run the following commands:
       ```bash
       git fetch upstream
       git merge upstream/main
       git push origin main
       ```

   This way, your private fork will stay up-to-date with the latest changes from the public repository while keeping your custom configurations and API keys secure.

2. **Add a `Procfile`**:
   - In your private fork, add a `Procfile` to the root of your repository. The `Procfile` defines how your Heroku app runs. You can find a `Procfile` example in this repository to guide you.
   - **Important**: Do not hard-code sensitive information, such as API keys, in your `Procfile` or any files committed to the repo.

3. **Configure your strategy**:
   - In your `Procfile`, specify the command to run your strategy (for example, `node src/strategies/ammOutbid.ts`).
   
4. **Create a new Heroku app**:
   - In Heroku, create a new app and connect it to your private repository.

5. **Configure environment variables in Heroku**:
   - Go to the Heroku app's dashboard, and under the **Settings** tab, configure all required `.env` variables. These should include API keys, secret tokens, and other sensitive information.
   - **Never commit API keys or sensitive data to your repository**. Always use Heroku’s environment variables feature for secure management of sensitive data.

6. **Deploy your bot**:
   - Use Heroku's automatic deploy feature or manually trigger a deployment from your private repository.
   - You can monitor logs and execution from the Heroku dashboard to ensure your bot is running correctly.

### Instructions for Public Fork (Use with Caution)

1. Make a **public fork** of this repository (not recommended if you’re using sensitive configurations).
2. Add a `Procfile` in the root of your fork. Please see the `Procfile` example in this repository for guidance.
3. **Do not commit any API keys or sensitive information** to your repository. Use Heroku’s environment variables instead.
4. Create a new Heroku app, link it to your **public fork**, and deploy your bot.

---

**Security Warning**: Never commit sensitive information like API keys or secret tokens to a public repository. Always store such data in Heroku's environment variables or another secure configuration system.

