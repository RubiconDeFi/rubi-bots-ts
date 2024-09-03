// src/strategies/ammOutBid/AMMOutBid.ts
import { ethers, BigNumber } from "ethers";
import { UniswapReferenceVenue } from "../../referenceVenues/uni";
import QUOTER_INTERFACE from "../../constants/Quoter"; // Import the correct interfaces
import QUOTER_INTERFACE_V2 from "../../constants/Quoterv2"; // Import the correct interfaces
import { TokenInfo } from "@uniswap/token-lists"; // Assuming you're using this structure for token info
import { Network } from "../../config/tokens";
import { getTokenInfoFromAddress } from "../../utils/rubicon";

export class AMMOutBid {
    chainID: number;
    baseAddress: string;
    quoteAddress: string;
    provider: ethers.providers.Provider;
    isV2: boolean;
    quoterContractAddress: string;
    uniFee: BigNumber;
    uniswapVenue: UniswapReferenceVenue;
    base: TokenInfo;
    quote: TokenInfo;
    
    constructor(
        chainID: number,
        provider: ethers.providers.Provider,
        baseAddress: string,
        quoteAddress: string,
        // isV2: boolean,
        // quoterContractAddress: string,
        uniFee: BigNumber
    ) {
        this.chainID = chainID;
        this.baseAddress = baseAddress;
        this.quoteAddress = quoteAddress;
        this.provider = provider;

        var isV2 = false; // OP main

        if (chainID == Network.BASE_MAINNET) {
            isV2 = true;
        }

        const addy = isV2 ? '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' : '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
        const _interface = isV2 ? QUOTER_INTERFACE_V2 : QUOTER_INTERFACE;
        
        if (isV2) {
            console.log("Using V2 Quoter Interface");
        } else {
            console.log("Using V1 Quoter Interface");
        }        

        if (!addy || !_interface || !provider) {
            throw new Error("Missing required parameters");
        }
        const quoterContract = new ethers.Contract(
            addy, 
            _interface,
            provider,
        ); // Replace with actual values

        this.isV2 = isV2;
        this.quoterContractAddress = quoterContract.address;
        this.uniFee = uniFee;

        this.base = getTokenInfoFromAddress(this.baseAddress, this.chainID);
        this.quote = getTokenInfoFromAddress(this.quoteAddress, this.chainID);

        this.uniswapVenue = new UniswapReferenceVenue(
            baseAddress,
            quoteAddress,
            provider,
            isV2,
            this.base,
            this.quote,
            uniFee,
            quoterContract,
        );
    }

    // Method to fetch and log the order book
    async logOrderBook() {
        try {
            const book = await this.uniswapVenue.getOrderBook();
            console.log("UNI Order Book:", book);
        } catch (error: any) {
            console.error("Error fetching UNI order book:", error.reason);
        }
    }
}
