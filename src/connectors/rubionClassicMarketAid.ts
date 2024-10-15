import { Contract, ethers } from "ethers";
import RUBICON_MARKET_ABI from "../constants/RubiconMarket.json";
import ERC20_ABI from "../constants/ERC20.json";
import MARKET_AID_ABI from "../constants/MarketAid.json";
import { formatUnits } from "ethers/lib/utils";

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
    private updateIntervalSeconds: number; // FREQUENCY FOR ONCHAIN GET UPDATES
    
    constructor(
        provider: ethers.providers.Provider,
        userWallet: ethers.Wallet,
        rubiconMarketAddress: string,
        marketAidAddress: string,
        baseTokenAddress: string,
        quoteTokenAddress: string,
        updateIntervalSeconds: number = 2
    ) {
        this.provider = provider;
        this.signer = userWallet;
        this.rubiconMarket = new Contract(rubiconMarketAddress, RUBICON_MARKET_ABI, this.signer);
        this.marketAid = new Contract(marketAidAddress, MARKET_AID_ABI, this.signer);
        this.baseTokenAddress = baseTokenAddress;
        this.quoteTokenAddress = quoteTokenAddress;
        this.updateIntervalSeconds = updateIntervalSeconds;
        this.startBalanceUpdate();
        this.startPeriodicUpdate();
        

        this.updateIntervalSeconds = updateIntervalSeconds;

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
        console.log("Starting periodic update with interval:", this.updateIntervalSeconds, "seconds");
        const val = this.updateIntervalSeconds * 1000;
        if (val == undefined || isNaN(val) || val == 0) {
            throw new Error("Update interval is undefined");
        }
        this.updateInterval = setInterval(this.updateOutstandingOrders.bind(this), val); // Update every minute
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

            // console.log("Outstanding offers:", this.outstandingOffers);
            // console.log("Outstanding UIDs:", this.outstandingUIDs);
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
        const gasPrice = await this.getGasPriceWithBuffer();
        return this.marketAid.placeMarketMakingTrades(
            [payGem, buyGem],
            payAmt,
            buyAmt,
            ethers.constants.Zero,
            ethers.constants.Zero,
            { gasPrice }
        );
    }

    async cancel(id: ethers.BigNumber): Promise<ethers.ContractTransaction> {
        const gasPrice = await this.getGasPriceWithBuffer();
        return this.marketAid.scrubStrategistTrade(id, { gasPrice });
    }

    async batchOffer(
        askNumerators: ethers.BigNumber[],
        askDenominators: ethers.BigNumber[],
        bidNumerators: ethers.BigNumber[],
        bidDenominators: ethers.BigNumber[]
    ): Promise<ethers.ContractTransaction> {
        console.log("this token pair is ", [this.baseTokenAddress, this.quoteTokenAddress]);
        console.log("this ask pay amount and base balance is ", formatUnits(askNumerators[0]), this.baseTokenBalance);
        
        const gasPrice = await this.getGasPriceWithBuffer();
        
        return this.marketAid.functions['batchMarketMakingTrades(address[2],uint256[],uint256[],uint256[],uint256[])'](
            [this.baseTokenAddress, this.quoteTokenAddress],
            askNumerators,
            askDenominators,
            bidNumerators,
            bidDenominators,
            { gasPrice }
        );
    }

    async batchCancel(ids: ethers.BigNumber[]): Promise<ethers.ContractTransaction> {
        const gasPrice = await this.getGasPriceWithBuffer();
        return this.marketAid.scrubStrategistTrades(ids, { gasPrice });
    }

    async batchRequote(
        ids: ethers.BigNumber[],
        askNumerators: ethers.BigNumber[],
        askDenominators: ethers.BigNumber[],
        bidNumerators: ethers.BigNumber[],
        bidDenominators: ethers.BigNumber[]
    ): Promise<ethers.ContractTransaction> {
        if (ids.length != askNumerators.length || ids.length != askDenominators.length || ids.length != bidNumerators.length || ids.length != bidDenominators.length) {
            throw new Error("IDs, payAmts, and buyAmts must have the same length");
        }
        const gasPrice = await this.getGasPriceWithBuffer();
        return this.marketAid.functions['batchRequoteOffers(uint256[],address[2],uint256[],uint256[],uint256[],uint256[])'](
            ids,
            [this.baseTokenAddress, this.quoteTokenAddress],
            askNumerators,
            askDenominators,
            bidNumerators,
            bidDenominators,
            { gasPrice }
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
        const gasPrice = await this.getGasPriceWithBuffer();
        return token.approve(this.rubiconMarket.address, amount, { gasPrice });
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

            // Store 99.9% of the actual balance
            // HACKY BC ROUNDING ERRORS SOMEHWERE OR MAYBE THE MARKET AID zero bal issue
            this.baseTokenBalance = assetWeiAmount.mul(999).div(1000);
            this.quoteTokenBalance = quoteWeiAmount.mul(999).div(1000);

            // // You might want to do something with the 'status' boolean if needed
            // // For example, log it or store it in a class property
            // console.log(`Liquidity status: ${status}`);
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

    private async getGasPriceWithBuffer(): Promise<ethers.BigNumber> {
        const gasPrice = await this.provider.getGasPrice();
        console.log("gas price is ", gasPrice);
        
        // Add a 1% buffer to the gas price
        return gasPrice.mul(101).div(100);
    }
}
