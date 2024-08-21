import { ethers, BigNumber } from "ethers";
import { TokenInfo } from "@uniswap/token-lists";
import { GladiusOrderBuilder, GladiusOrder, NonceManager } from "@rubicondefi/gladius-sdk";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import axios from "axios";
import MultiCall from "@indexed-finance/multicall";
import { GLADIUS } from "../config/rubicon";
import { permit2addresses, reactorAddresses } from "../config/tokens";
import { getTokenInfoFromAddress } from "../utils.ts/rubicon";

export class RubiconConnector {
    chainID: number;
    userAddress: string;
    baseAddress: string;
    quoteAddress: string;
    base: TokenInfo;
    quote: TokenInfo;
    provider: ethers.providers.Provider;
    GLADIUS_URL: string;
    permit2address: string;
    reactorAddress: string;
    onChainAvailableAssetBalance: number;
    onChainAvailableQuoteBalance: number;
    pollingInterval: number;
    multi: MultiCall;
    nextNoncesToUse: number[];
    signer: ethers.Wallet;

    constructor(
        chainID: number,
        wallet: ethers.Wallet,
        userAddress: string,
        baseAddress: string,
        quoteAddress: string,
        performAllowanceAndBalanceCheck: boolean = true,
        pollingInterval: number = 2000,
    ) {
        this.chainID = chainID;
        this.userAddress = userAddress;
        this.baseAddress = baseAddress;
        this.quoteAddress = quoteAddress;
        this.provider = wallet.provider!;
        this.signer = wallet;

        if (this.provider == null || this.provider == undefined) {
            throw new Error("Provider not found from provided signer");
        }
        this.permit2address = permit2addresses[this.chainID];
        this.reactorAddress = reactorAddresses[this.chainID];
        this.GLADIUS_URL = GLADIUS; // Example API URL
        this.onChainAvailableAssetBalance = 0;
        this.onChainAvailableQuoteBalance = 0;
        this.pollingInterval = pollingInterval;
        this.nextNoncesToUse = [];

        const multi = new MultiCall(this.provider);
        this.multi = multi;

        this.base = getTokenInfoFromAddress(this.baseAddress, this.chainID);
        this.quote = getTokenInfoFromAddress(this.quoteAddress, this.chainID);

        if (performAllowanceAndBalanceCheck) {
            this.monitorOnchainAssetsAndInventory(); // Start monitoring balance and allowance
        }

        console.log("Rubicon Connector Initialized", "connected to", this.signer.address);
    }

    // Monitor on-chain balances and allowances
    async monitorOnchainAssetsAndInventory() {
        // Polling loop to call every 2 seconds (or based on pollingInterval)
        setInterval(async () => {
            try {
                const tokens = [this.baseAddress, this.quoteAddress];
                const account = this.userAddress;

                // Get balances and allowances via multicall
                const [, getBalancesAndAllowances]: [number, any] = await this.multi.getBalancesAndAllowances(tokens, account, this.permit2address);

                const assetBalance: string = formatUnits(getBalancesAndAllowances[this.baseAddress].balance, this.base.decimals);
                const quoteBalance: string = formatUnits(getBalancesAndAllowances[this.quoteAddress].balance, this.quote.decimals);

                console.log(`Address ${account} has balances: ${assetBalance} ${this.base.symbol} and ${quoteBalance} ${this.quote.symbol}`);

                this.onChainAvailableAssetBalance = parseFloat(assetBalance);
                this.onChainAvailableQuoteBalance = parseFloat(quoteBalance);

                // Check allowances
                const assetApproval: string = formatUnits(getBalancesAndAllowances[this.baseAddress].allowance, this.base.decimals);
                const quoteApproval: string = formatUnits(getBalancesAndAllowances[this.quoteAddress].allowance, this.quote.decimals);

                if (parseFloat(assetApproval) < parseFloat(assetBalance)) {
                    throw new Error("Asset approval is less than asset balance");
                }
                if (parseFloat(quoteApproval) < parseFloat(quoteBalance)) {
                    throw new Error("Quote approval is less than quote balance");
                }
            } catch (error) {
                console.error("Error monitoring on-chain assets and inventory:", error);
            }
        }, this.pollingInterval);
    }

    // Method to get available nonces using the Nonce Manager
    async getAvailableNoncesNM(length: number): Promise<number[]> {
        const nm = new NonceManager(this.provider as ethers.providers.BaseProvider, this.chainID, this.permit2address);
        const out: number[] = [];
        for (let index = 0; index < length; index++) {
            const nonce = await nm.useNonce(this.userAddress);
            out.push(nonce.toNumber());
        }
        return out;
    }

    // Method to monitor and update the next nonces to use
    monitorNonceAndUpdateNextNoncesToUse() {
        setInterval(async () => {
            try {
                const targetLengthToAcquire = 10;
                this.nextNoncesToUse = await this.getAvailableNoncesNM(targetLengthToAcquire);
                console.log("Got these nonces to use: ", this.nextNoncesToUse);
            } catch (error) {
                console.error("Error monitoring nonces:", error);
            }
        }, 5000); // Poll every 5 seconds to update nonces
    }

    // Function to place an order on Rubicon
    async placeOrder(size: number, price: number, isBid: boolean): Promise<any> {
        try {
            const inputToken = isBid ? this.quote : this.base;
            const outputToken = isBid ? this.base : this.quote;
            const account = this.userAddress;

            const inputAmount = parseUnits(size.toString(), inputToken.decimals);
            const outputAmount = isBid
                ? parseUnits((size / price).toString(), outputToken.decimals)
                : parseUnits((size * price).toString(), outputToken.decimals);

            const order = new GladiusOrderBuilder(this.chainID, this.reactorAddress, this.permit2address)
                .deadline(Math.floor(Date.now() / 1000) + 600) // 10 minutes from now
                .swapper(account)
                .input({
                    token: inputToken.address,
                    startAmount: inputAmount,
                    endAmount: inputAmount,
                })
                .output({
                    token: outputToken.address,
                    startAmount: outputAmount,
                    endAmount: outputAmount,
                    recipient: account,
                })
                .fillThreshold(BigNumber.from(1))
                .build();

            const { domain, types, values } = order.permitData();
            const signature = await this.signer._signTypedData(domain, types, values);
            const serializedOrder = order.serialize();

            const payload = {
                encodedOrder: serializedOrder,
                signature,
                chainId: this.chainID,
            };

            const response = await axios.post(`${this.GLADIUS_URL}/dutch-auction/order`, payload);
            console.log("Order placed:", response.data);
            return response.data;
        } catch (error: any) {
            console.error("Error placing order:", error);
            throw error;
        }
    }

    // Function to cancel an order
    async cancelOrder(orderHash: string): Promise<boolean> {
        try {
            const response = await axios.post(`${this.GLADIUS_URL}/dutch-auction/cancel`, {
                signature: await this.signer.signMessage(orderHash),
                hash: orderHash,
                swapper: this.userAddress,
            });

            console.log("Order cancelled:", response.data);
            return true;
        } catch (error: any) {
            console.error("Error cancelling order:", error);
            return false;
        }
    }

    async editOrder(
        orderHashToCancel: string,
        newSize: number,
        newPrice: number,
        isBid: boolean
    ): Promise<any> {
        try {
            // Ensure that we have a hash to cancel
            if (!orderHashToCancel) {
                throw new Error("A hash to cancel is required.");
            }

            // Define the new order details
            const inputToken = isBid ? this.quote : this.base;
            const outputToken = isBid ? this.base : this.quote;
            const chainId = this.chainID;
            const account = this.userAddress;

            // Sign the original order hash
            const originalOrderSignature = await this.signer.signMessage(orderHashToCancel);

            // Set the nonce manager
            const nonceMgr = new NonceManager(this.provider as ethers.providers.BaseProvider, chainId, this.permit2address);
            const currentNonce = await nonceMgr.useNonce(account);

            // Calculate the deadline (e.g., 10 minutes from now)
            const _deadline = Math.floor(Date.now() / 1000) + 600;

            // Calculate the new order's input and output amounts
            const inputAmount = newSize.toFixed(inputToken.decimals);
            const outputAmount = isBid
                ? (newSize / newPrice).toFixed(outputToken.decimals)
                : (newSize * newPrice).toFixed(outputToken.decimals);

            // Build the new order using GladiusOrderBuilder
            const order = new GladiusOrderBuilder(chainId, this.reactorAddress, this.permit2address)
                .deadline(_deadline)
                .decayEndTime(_deadline - 1)
                .decayStartTime(Math.floor(Date.now() / 1000))
                .nonce(currentNonce)
                .swapper(account)
                .input({
                    token: inputToken.address,
                    startAmount: ethers.utils.parseUnits(inputAmount, inputToken.decimals),
                    endAmount: ethers.utils.parseUnits(inputAmount, inputToken.decimals),
                })
                .output({
                    token: outputToken.address,
                    startAmount: ethers.utils.parseUnits(outputAmount, outputToken.decimals),
                    endAmount: ethers.utils.parseUnits(outputAmount, outputToken.decimals),
                    recipient: account,
                })
                .fillThreshold(BigNumber.from(1))
                .build();

            // Extract the permit data and sign the new order
            const { domain, types, values } = order.permitData();
            const newOrderSignature = await this.signer._signTypedData(domain, types, values);
            const newEncodedOrder = order.serialize();

            // Prepare the request body
            const requestBody = {
                originalOrderHash: orderHashToCancel,
                originalOrderSignature,
                newEncodedOrder,
                newOrderSignature,
                swapper: account,
                chainId,
            };

            // Log the request body for debugging
            console.log("Editing order with request body:", requestBody);

            // Make the API request to edit the order
            const response = await axios.post(`${this.GLADIUS_URL}/dutch-auction/edit-order`, requestBody, {
                headers: {
                    "x-api-key": 'YOUR_API_KEY_HERE', // Replace with your actual API key
                },
            });

            console.log("Edit order response:", response.data);
            return response.data;
        } catch (error: any) {
            console.error("Error editing order:", error.response ? error.response.data : error.message);
            throw error;
        }
    }

}
