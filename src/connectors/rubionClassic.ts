import { Contract, ethers } from "ethers";
import RUBICON_MARKET_ABI from "../constants/RubiconMarket.json";
import ERC20_ABI from "../constants/ERC20.json";

interface OfferStatus {
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
    private signer: ethers.Signer;
    private rubiconMarket: ethers.Contract;
    private outstandingOffers: Map<string, OfferStatus> = new Map();
    private updateInterval: NodeJS.Timeout | null = null;

    constructor(
        provider: ethers.providers.Provider,
        signer: ethers.Signer,
        rubiconMarketAddress: string
    ) {
        this.provider = provider;
        this.signer = signer;
        this.rubiconMarket = new Contract(rubiconMarketAddress, RUBICON_MARKET_ABI, this.signer);
        this.setupEventListeners();
        this.startPeriodicUpdate();
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
        for (const id of this.outstandingOffers.keys()) {
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
}
