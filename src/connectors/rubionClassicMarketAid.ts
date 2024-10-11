import { Contract, ethers } from "ethers";
import RUBICON_MARKET_ABI from "../constants/RubiconMarket.json";
import ERC20_ABI from "../constants/ERC20.json";
import MARKET_AID_ABI from "../constants/MarketAid.json";

// Define the MarketOffer struct
interface MarketOffer {
    relevantStratTradeId: ethers.BigNumber;
    bidPay: ethers.BigNumber;
    bidBuy: ethers.BigNumber;
    askPay: ethers.BigNumber;
    askBuy: ethers.BigNumber;
}

export class RubiconClassicConnector {
    private provider: ethers.providers.Provider;
    private signer: ethers.Wallet;
    private rubiconMarket: ethers.Contract;
    private marketAid: ethers.Contract;
    private updateInterval: NodeJS.Timeout | null = null;
    private balanceUpdateInterval: NodeJS.Timeout | null = null;
    private baseTokenAddress: string;
    private quoteTokenAddress: string;
    private baseTokenBalance: ethers.BigNumber = ethers.constants.Zero;
    private quoteTokenBalance: ethers.BigNumber = ethers.constants.Zero;
    private outstandingOffers: MarketOffer[] = [];
    private outstandingUIDs: ethers.BigNumber[] = [];

    constructor(
        provider: ethers.providers.Provider,
        userWallet: ethers.Wallet,
        rubiconMarketAddress: string,
        marketAidAddress: string,
        baseTokenAddress: string,
        quoteTokenAddress: string
    ) {
        this.provider = provider;
        this.signer = userWallet;
        this.rubiconMarket = new Contract(rubiconMarketAddress, RUBICON_MARKET_ABI, this.signer);
        this.marketAid = new Contract(marketAidAddress, MARKET_AID_ABI, this.signer);
        this.baseTokenAddress = baseTokenAddress;
        this.quoteTokenAddress = quoteTokenAddress;
        this.startBalanceUpdate();
        this.startPeriodicUpdate();

        if (!this.rubiconMarket) {
            throw new Error("Rubicon Market is undefined");
        }
        if (!this.marketAid) {
            throw new Error("Market Aid is undefined");
        }
        if (!this.baseTokenAddress) {
            throw new Error("Base token address is undefined");
        }
        if (!this.quoteTokenAddress) {
            throw new Error("Quote token address is undefined");
        }
    }

    private startPeriodicUpdate() {
        this.updateInterval = setInterval(this.updateOutstandingOrders.bind(this), 60000); // Update every minute
    }

    private async updateOutstandingOrders() {
        try {
            const orders = await this.marketAid.getStrategistBookWithPriceData(
                this.baseTokenAddress,
                this.quoteTokenAddress,
                this.signer.address
            );
            this.outstandingOffers = orders;

            const uids = await this.marketAid.getOutstandingStrategistTrades(
                this.baseTokenAddress,
                this.quoteTokenAddress,
                this.signer.address
            );
            this.outstandingUIDs = uids;
        } catch (error) {
            console.error("Error updating outstanding orders:", error);
        }
    }

    public getOutstandingOffers(): MarketOffer[] {
        return this.outstandingOffers;
    }

    public getOutstandingUIDs(): ethers.BigNumber[] {
        return this.outstandingUIDs;
    }

    async offer(
        payAmt: ethers.BigNumber,
        payGem: string,
        buyAmt: ethers.BigNumber,
        buyGem: string
    ): Promise<ethers.ContractTransaction> {
        return this.marketAid.placeMarketMakingTrades(
            [payGem, buyGem],
            payAmt,
            buyAmt,
            ethers.constants.Zero,
            ethers.constants.Zero
        );
    }

    async cancel(id: ethers.BigNumber): Promise<ethers.ContractTransaction> {
        return this.marketAid.scrubStrategistTrade(id);
    }

    async batchOffer(
        payAmts: ethers.BigNumber[],
        payGems: string[],
        buyAmts: ethers.BigNumber[],
        buyGems: string[]
    ): Promise<ethers.ContractTransaction> {
        return this.marketAid.batchMarketMakingTrades(
            [this.baseTokenAddress, this.quoteTokenAddress],
            payAmts,
            buyAmts,
            new Array(payAmts.length).fill(ethers.constants.Zero),
            new Array(payAmts.length).fill(ethers.constants.Zero)
        );
    }

    async batchCancel(ids: ethers.BigNumber[]): Promise<ethers.ContractTransaction> {
        return this.marketAid.scrubStrategistTrades(ids);
    }

    async batchRequote(
        ids: ethers.BigNumber[],
        payAmts: ethers.BigNumber[],
        payGems: string[],
        buyAmts: ethers.BigNumber[],
        buyGems: string[]
    ): Promise<ethers.ContractTransaction> {
        return this.marketAid.batchRequoteOffers(
            ids,
            [this.baseTokenAddress, this.quoteTokenAddress],
            payAmts,
            buyAmts,
            new Array(payAmts.length).fill(ethers.constants.Zero),
            new Array(payAmts.length).fill(ethers.constants.Zero)
        );
    }

    async getBestOffer(sellGem: string, buyGem: string): Promise<ethers.BigNumber> {
        return this.rubiconMarket.getBestOffer(sellGem, buyGem);
    }

    async getOffer(id: ethers.BigNumber): Promise<[ethers.BigNumber, string, ethers.BigNumber, string]> {
        return this.rubiconMarket.getOffer(id);
    }


    async approveToken(tokenAddress: string, amount: ethers.BigNumber): Promise<ethers.ContractTransaction> {
        const token = new Contract(tokenAddress, ERC20_ABI, this.signer);
        return token.approve(this.rubiconMarket.address, amount);
    }

    async getOutstandingOrders(): Promise<MarketOffer[]> {
        return this.marketAid.getStrategistBookWithPriceData(
            this.baseTokenAddress,
            this.quoteTokenAddress,
            this.signer.address
        );
    }


    private startBalanceUpdate() {
        this.updateBalances(); // Initial update
        this.balanceUpdateInterval = setInterval(this.updateBalances.bind(this), 30000); // Update every 30 seconds
    }

    private async updateBalances() {
        try {
            const [quoteWeiAmount, assetWeiAmount, status] = await this.marketAid.getStrategistTotalLiquidity(
                this.baseTokenAddress,
                this.quoteTokenAddress,
                this.signer.address
            );

            this.baseTokenBalance = assetWeiAmount;
            this.quoteTokenBalance = quoteWeiAmount;

            // You might want to do something with the 'status' boolean if needed
            // For example, log it or store it in a class property
            console.log(`Liquidity status: ${status}`);
        } catch (error) {
            console.error("Error updating balances:", error);
        }
    }

    public getBaseTokenBalance(): ethers.BigNumber {
        return this.baseTokenBalance;
    }

    public getQuoteTokenBalance(): ethers.BigNumber {
        return this.quoteTokenBalance;
    }

    public stopAllUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        if (this.balanceUpdateInterval) {
            clearInterval(this.balanceUpdateInterval);
            this.balanceUpdateInterval = null;
        }
    }

    // Add other methods for interacting with the MarketAid contract as needed
    // For example: offer, cancel, batchOffer, batchCancel, batchRequote, etc.
}