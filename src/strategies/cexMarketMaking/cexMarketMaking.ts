/// Strategy that targets a CEX market and places orders on Rubicon depending on the CEXs liquidity curve
import { ethers } from "ethers";

export class CexMarketMaking {
    /// Strategy that targets a CEX market and places orders on Rubicon depending on the CEXs liquidity curve
    chainID: number;
    userAddress: string;
    baseAddress: string;
    quoteAddress: string;
    provider: ethers.providers.Provider;

    /// CEX Related Information
    referenceCEXBaseTicker: string;
    referenceCEXQuoteTicker: string;

    constructor(
        chainID: number,
        provider: ethers.providers.Provider,
        userAddress: string,
        baseAddress: string,
        quoteAddress: string,
        performAllowanceAndBalanceCheck: boolean = true,
        referenceCEXBaseTicker: string,
        referenceCEXQuoteTicker: string,
    ) {
        this.chainID = chainID;
        this.userAddress = userAddress;
        this.baseAddress = baseAddress;
        this.quoteAddress = quoteAddress;
        this.provider = provider;
        this.referenceCEXBaseTicker = referenceCEXBaseTicker;
        this.referenceCEXQuoteTicker = referenceCEXQuoteTicker;
    }

    runStrategy() {
        /// Run the strategy
        console.log("Running CEX Market Making Strategy");
    }
}