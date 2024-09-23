import { Contract, ethers } from "ethers";
import RUBICON_MARKET_ABI from "../constants/RubiconMarket.json";
import ERC20_ABI from "../constants/ERC20.json";

export interface OfferStatus {
    id: ethers.BigNumber;
    payAmt: ethers.BigNumber;
    payGem: string;
    buyAmt: ethers.BigNumber;
    buyGem: string;
    owner: string;
    timestamp: number;
    isActive: boolean;
}

export class RubiconClassicConnector {
    private provider: ethers.providers.Provider;
    private signer: ethers.Wallet;
    private rubiconMarket: ethers.Contract;
    private outstandingOffers: Map<string, OfferStatus> = new Map();
    private updateInterval: NodeJS.Timeout | null = null;
    private balanceUpdateInterval: NodeJS.Timeout | null = null;
    private baseTokenAddress: string;
    private quoteTokenAddress: string;
    private baseTokenBalance: ethers.BigNumber = ethers.constants.Zero;
    private quoteTokenBalance: ethers.BigNumber = ethers.constants.Zero;

    constructor(
        provider: ethers.providers.Provider,
        userWallet: ethers.Wallet,
        rubiconMarketAddress: string,
        baseTokenAddress: string,
        quoteTokenAddress: string
    ) {
        this.provider = provider;
        this.signer = userWallet;
        this.rubiconMarket = new Contract(rubiconMarketAddress, RUBICON_MARKET_ABI, this.signer);
        this.baseTokenAddress = baseTokenAddress;
        this.quoteTokenAddress = quoteTokenAddress;
        this.setupEventListeners();
        this.startPeriodicUpdate();
        this.startBalanceUpdate();

        if (!this.rubiconMarket) {
            throw new Error("Rubicon Market is undefined");
        }
        if (!this.baseTokenAddress) {
            throw new Error("Base token address is undefined");
        }
        if (!this.quoteTokenAddress) {
            throw new Error("Quote token address is undefined");
        }
    }

    public async checkApprovals() {    
        if (!this.baseTokenAddress || !this.quoteTokenAddress) {
            // Wait one second before checking again
            throw new Error("Base or quote token address is undefined");
            // return this.checkApprovals();
        }    
        const baseToken = new Contract(this.baseTokenAddress, ERC20_ABI, this.signer);
        const quoteToken = new Contract(this.quoteTokenAddress, ERC20_ABI, this.signer);
        const baseTokenBalancecheck = await baseToken.balanceOf(this.signer.getAddress());
        const quoteTokenBalancecheck = await quoteToken.balanceOf(this.signer.getAddress());
        const [basetoknBal, quoteTokenBal] = await Promise.all([baseTokenBalancecheck, quoteTokenBalancecheck]);
        const baseTokenCheck = this.checkApproval(this.baseTokenAddress, basetoknBal);
        const quoteTokenCheck = this.checkApproval(this.quoteTokenAddress, quoteTokenBal);
        const [baseTokenCheck_, quoteTokenCheck_] = await Promise.all([baseTokenCheck, quoteTokenCheck]);
        if (!baseTokenCheck_) {
            console.log("MISSING APPROVAL FOR BASE TOKEN", this.baseTokenAddress, basetoknBal);
            console.log("CAUTION DOING BIG APPROVAL you have 10 sec to cancel");
            
            // Wait 2 seconds before approving
            await new Promise(resolve => setTimeout(resolve, 10000));
            await this.approveToken(this.baseTokenAddress, basetoknBal.mul(1000));
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        if (!quoteTokenCheck_) {
            console.log("MISSING APPROVAL FOR QUOTE TOKEN", this.quoteTokenAddress, quoteTokenBal);
            console.log("CAUTION DOING BIG APPROVAL you have 10 sec to cancel");
            
            // Wait 2 seconds before approving
            await new Promise(resolve => setTimeout(resolve, quoteTokenBal.mul(1000)));
            await this.approveToken(this.quoteTokenAddress, quoteTokenBal);
        }
        return { baseTokenCheck, quoteTokenCheck };
    }

    private setupEventListeners() {
        this.rubiconMarket.on("emitOffer", this.handleOfferEvent.bind(this));
        this.rubiconMarket.on("emitTake", this.handleTakeEvent.bind(this));
        this.rubiconMarket.on("emitCancel", this.handleCancelEvent.bind(this));
    }

    private async handleOfferEvent(id: ethers.BigNumber, pair: string, maker: string, payGem: string, buyGem: string, payAmt: ethers.BigNumber, buyAmt: ethers.BigNumber) {
        const offerStatus: OfferStatus = {
            id,
            payAmt,
            payGem,
            buyAmt,
            buyGem,
            owner: maker,
            timestamp: Date.now(),
            isActive: true
        };
        this.outstandingOffers.set(id.toString(), offerStatus);
    }

    private handleTakeEvent(id: ethers.BigNumber) {
        this.updateOfferStatus(id);
    }

    private handleCancelEvent(id: ethers.BigNumber) {
        this.outstandingOffers.delete(id.toString());
    }

    private async updateOfferStatus(id: ethers.BigNumber) {
        const offer = await this.getOffer(id);
        if (offer[0].isZero() && offer[2].isZero()) {
            this.outstandingOffers.delete(id.toString());
        } else {
            const existingOffer = this.outstandingOffers.get(id.toString());
            if (existingOffer) {
                existingOffer.payAmt = offer[0];
                existingOffer.buyAmt = offer[2];
                existingOffer.timestamp = Date.now();
            }
        }
    }

    private startPeriodicUpdate() {
        this.updateInterval = setInterval(this.updateAllOffers.bind(this), 60000); // Update every minute
    }

    private async updateAllOffers() {
        for (const id of Array.from(this.outstandingOffers.keys())) {
            await this.updateOfferStatus(ethers.BigNumber.from(id));
        }
    }

    public stopPeriodicUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    async offer(
        payAmt: ethers.BigNumber,
        payGem: string,
        buyAmt: ethers.BigNumber,
        buyGem: string
    ): Promise<ethers.ContractTransaction> {
        return this.rubiconMarket.offer(payAmt, payGem, buyAmt, buyGem);
    }

    async cancel(id: ethers.BigNumber): Promise<ethers.ContractTransaction> {
        return this.rubiconMarket.cancel(id);
    }

    async buy(id: ethers.BigNumber, amount: ethers.BigNumber): Promise<ethers.ContractTransaction> {
        return this.rubiconMarket.buy(id, amount);
    }

    async batchOffer(
        payAmts: ethers.BigNumber[],
        payGems: string[],
        buyAmts: ethers.BigNumber[],
        buyGems: string[]
    ): Promise<ethers.ContractTransaction> {
        return this.rubiconMarket.batchOffer(payAmts, payGems, buyAmts, buyGems);
    }

    async batchCancel(ids: ethers.BigNumber[]): Promise<ethers.ContractTransaction> {
        return this.rubiconMarket.batchCancel(ids);
    }

    async batchRequote(
        ids: ethers.BigNumber[],
        payAmts: ethers.BigNumber[],
        payGems: string[],
        buyAmts: ethers.BigNumber[],
        buyGems: string[]
    ): Promise<ethers.ContractTransaction> {
        return this.rubiconMarket.batchRequote(ids, payAmts, payGems, buyAmts, buyGems);
    }

    async getBestOffer(sellGem: string, buyGem: string): Promise<ethers.BigNumber> {
        return this.rubiconMarket.getBestOffer(sellGem, buyGem);
    }

    async getOffer(id: ethers.BigNumber): Promise<[ethers.BigNumber, string, ethers.BigNumber, string]> {
        return this.rubiconMarket.getOffer(id);
    }

    getOutstandingOffers(): OfferStatus[] {
        return Array.from(this.outstandingOffers.values());
    }

    async approveToken(tokenAddress: string, amount: ethers.BigNumber): Promise<ethers.ContractTransaction> {
        const token = new Contract(tokenAddress, ERC20_ABI, this.signer);
        return token.approve(this.rubiconMarket.address, amount);
    }

    async getOutstandingOrders(userAddress: string): Promise<ethers.BigNumber[]> {
        // Ensure our in-memory state is up-to-date
        await this.updateAllOffers();

        // Filter offers for the specified user
        const userOffers = Array.from(this.outstandingOffers.values())
            .filter(offer => offer.owner.toLowerCase() === userAddress.toLowerCase())
            .map(offer => offer.id);

        return userOffers;
    }

    async checkApproval(tokenAddress: string, amount: ethers.BigNumber): Promise<boolean> {
        const token = new Contract(tokenAddress, ERC20_ABI, this.signer);
        const allowance = await token.allowance(this.signer.getAddress(), this.rubiconMarket.address);
        return allowance.gte(amount);
    }

    private startBalanceUpdate() {
        this.updateBalances(); // Initial update
        this.balanceUpdateInterval = setInterval(this.updateBalances.bind(this), 30000); // Update every 30 seconds
    }

    private async updateBalances() {
        const baseToken = new Contract(this.baseTokenAddress, ERC20_ABI, this.provider);
        const quoteToken = new Contract(this.quoteTokenAddress, ERC20_ABI, this.provider);

        const [baseBalance, quoteBalance] = await Promise.all([
            baseToken.balanceOf(this.signer.address),
            quoteToken.balanceOf(this.signer.address)
        ]);

        this.baseTokenBalance = baseBalance;
        this.quoteTokenBalance = quoteBalance;
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
}
