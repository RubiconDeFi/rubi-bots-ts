import { ethers, BigNumber } from "ethers";
import { TokenInfo } from "@uniswap/token-lists";
import { GladiusOrderBuilder, GladiusOrder, NonceManager, GladiusOrderValidator } from "@rubicondefi/gladius-sdk";
import { formatUnits, getAddress, parseUnits } from "ethers/lib/utils";
import axios from "axios";
import MultiCall from "@indexed-finance/multicall";
import { GLADIUS, MIN_ORDER_SIZES } from "../config/rubicon";
import { permit2addresses, reactorAddresses } from "../config/tokens";
import { getTokenInfoFromAddress } from "../utils/rubicon";

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
        this.monitorNonceAndUpdateNextNoncesToUse();   
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
    async monitorNonceAndUpdateNextNoncesToUse() {
        const targetLengthToAcquire = 10;
        // TODO: could do a multicall or read from permit2 mroe efficiently
        this.nextNoncesToUse = await this.getAvailableNoncesNM(targetLengthToAcquire);

        setInterval(async () => {
            try {
                const targetLengthToAcquire = 10;
                // TODO: could do a multicall or read from permit2 mroe efficiently
                this.nextNoncesToUse = await this.getAvailableNoncesNM(targetLengthToAcquire);
                console.log("Got these nonces to use: ", this.nextNoncesToUse);
            } catch (error) {
                console.error("Error monitoring nonces:", error);
            }
        }, 10000); // Poll every 5 seconds to update nonces
    }

    // Function to place an order on Rubicon
    // ASSUME SIZE IS IN BASE AMOUNT
    async placeOrder(_size: number, price: number, isBid: boolean): Promise<any> {
        // console.log("Placing order", _size, price, isBid);
        if (_size <= 0) {
            console.log("Size must be greater than 0 to place an order");
            return;
        }
        try {
            const inputToken = isBid ? this.quote : this.base;
            const outputToken = isBid ? this.base : this.quote;
            const account = this.userAddress;
            const size = isBid ? _size * price : _size;

            if (MIN_ORDER_SIZES[inputToken.symbol] > size) {
               console.log(`Minimum order size for ${inputToken.symbol} is ${MIN_ORDER_SIZES[inputToken.symbol]} skipping order`);
               return;
            }

            // Arbitrarily one minute for now... TODO: make configurable
            const _deadline = Math.floor(Date.now() / 1000) + 60;

            const orderNonce = this.nextNoncesToUse.length > 0 ? this.nextNoncesToUse.shift() : await new NonceManager(this.provider as ethers.providers.BaseProvider, this.chainID, this.permit2address).useNonce(account);

            const inputAmount = parseUnits(size.toFixed(inputToken.decimals), inputToken.decimals);
            const outputAmount = isBid
                ? parseUnits((size / price).toFixed(outputToken.decimals), outputToken.decimals)
                : parseUnits((size * price).toFixed(outputToken.decimals), outputToken.decimals);

            const order = new GladiusOrderBuilder(this.chainID, this.reactorAddress, this.permit2address)
                .deadline(_deadline)
                .decayEndTime(_deadline - 1)
                .decayStartTime(Math.floor(Date.now() / 1000))
                .nonce(BigNumber.from(orderNonce))
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

            // console.log("Order built...");

            const { domain, types, values } = order.permitData();
            const signature = await this.signer._signTypedData(domain, types, values);
            const serializedOrder = order.serialize();

            const payload = {
                encodedOrder: serializedOrder,
                signature,
                chainId: this.chainID,
            };

            console.log("Sending order to Rubicon...");
            const response = await axios.post(`${this.GLADIUS_URL}/dutch-auction/order`, payload);
            console.log("Order placed:", response.data);
            return response.data;
        } catch (error: any) {
            console.error(`Error placing isbID ${isBid} size ${_size} price ${price} order:`, error.response ? error.response.data : error.message);
            throw error;
        }
    }

    // Function to cancel an order
    async cancelOrder(orderHash: string): Promise<boolean> {
        try {
            const sig = await this.signer.signMessage(orderHash);
            const response = await axios.post(`${this.GLADIUS_URL}/dutch-auction/cancel`, {
                signature: sig,
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
        _newSize: number,
        newPrice: number,
        isBid: boolean
    ): Promise<any> {
        try {
            // Ensure that we have a hash to cancel
            if (!orderHashToCancel) {
                throw new Error("A hash to cancel is required.");
            }

            if (_newSize <= 0) {
                console.log("Size must be greater than 0 to edit an order, cancelling the hash provided");
                return this.cancelOrder(orderHashToCancel);
            }

            // Define the new order details
            const inputToken = isBid ? this.quote : this.base;
            const outputToken = isBid ? this.base : this.quote;
            const chainId = this.chainID;
            const account = getAddress(this.userAddress);
            const newSize = isBid ? _newSize * newPrice : _newSize;

            // TODO: Do we just cancel here instead??? idk if it passes through and does the cancel or not..
            // if (MIN_ORDER_SIZES[inputToken.symbol] > newSize) {
            //     console.log(`Minimum order size for ${inputToken.symbol} is ${MIN_ORDER_SIZES[inputToken.symbol]} skipping order`);
            //     return;
            //  }

            // if (this.signer.address != account) {
            //     throw new Error("Account does not match signer");
            // }
            
            // Sign the original order hash
            const originalOrderSignature = await this.signer.signMessage(orderHashToCancel);

            // Set the nonce manager
            // const nonceMgr = new NonceManager(this.provider as ethers.providers.BaseProvider, chainId, this.permit2address);
            // const currentNonce = await nonceMgr.useNonce(account);

            const orderNonce = this.nextNoncesToUse.length > 0 ? this.nextNoncesToUse.shift() : await new NonceManager(this.provider as ethers.providers.BaseProvider, this.chainID, this.permit2address).useNonce(account);

            // Calculate the deadline (e.g., 10 minutes from now)
            const _deadline = Math.floor(Date.now() / 1000) + 60;

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
                .nonce(BigNumber.from(orderNonce))
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
            // console.log("Editing order with request body:", requestBody);

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
