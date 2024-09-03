// src/strategies/ammOutBid/AMMOutBid.ts
import { ethers, BigNumber } from "ethers";
import { UniswapReferenceVenue } from "../../referenceVenues/uniswap";
import { QUOTER_INTERFACE, QUOTER_INTERFACE_V2 } from "../../utils/uniswap"; // Import the correct interfaces
import { TokenInfo } from "@uniswap/token-lists"; // Assuming you're using this structure for token info

export class AMMOutBid {
    chainID: number;
    baseAddress: string;
    quoteAddress: string;
    provider: ethers.providers.Provider;
    isV2: boolean;
    quoterContractAddress: string;
    uniFee: BigNumber;
    uniswapVenue: UniswapReferenceVenue;

    constructor(
        chainID: number,
        provider: ethers.providers.Provider,
        baseAddress: string,
        quoteAddress: string,
        isV2: boolean,
        quoterContractAddress: string,
        uniFee: BigNumber
    ) {
        this.chainID = chainID;
        this.baseAddress = baseAddress;
        this.quoteAddress = quoteAddress;
        this.provider = provider;
        this.isV2 = isV2;
        this.quoterContractAddress = quoterContractAddress;
        this.uniFee = uniFee;

        // Initialize UniswapReferenceVenue with dummy TokenInfo
        const dummyToken: TokenInfo = {
            chainId: chainID,
            address: baseAddress,
            decimals: 18, // Adjust as needed
            symbol: "BASE",
            name: "Base Token",
        };

        const dummyQuote: TokenInfo = {
            chainId: chainID,
            address: quoteAddress,
            decimals: 18, // Adjust as needed
            symbol: "QUOTE",
            name: "Quote Token",
        };

        const quoterInterface = isV2 ? QUOTER_INTERFACE_V2 : QUOTER_INTERFACE;

        this.uniswapVenue = new UniswapReferenceVenue(
            baseAddress,
            quoteAddress,
            provider.connection.url,
            isV2,
            dummyToken,
            dummyQuote,
            uniFee,
            quoterContractAddress,
            quoterInterface
        );
    }

    // Method to fetch and log the order book
    async logOrderBook() {
        try {
            const book = await this.uniswapVenue.fetchUniswapOrderBook();
            console.log("Order Book:", book);
        } catch (error) {
            console.error("Error fetching order book:", error);
        }
    }
}
