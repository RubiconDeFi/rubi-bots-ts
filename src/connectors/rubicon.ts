import { TokenInfo } from "@uniswap/token-lists";
import { ethers } from "ethers";
/// Class for placing orders and managing liquidity on Rubicon

export class RubiconConnector {
    chainID: number;
    userAddress: string;
    baseAddress: string;
    quoteAddress: string;
    base: TokenInfo;
    quote: TokenInfo;
    provider: ethers.providers.Provider;

    /// Assume pair based for now
    constructor(
        chainID: number,
        provider: ethers.providers.Provider,
        userAddress: string,
        baseAddress: string,
        quoteAddress: string,
        performAllowanceAndBalanceCheck: boolean = true,
    ) {
        this.chainID = chainID;
        this.userAddress = userAddress;
        this.baseAddress = baseAddress;
        this.quoteAddress = quoteAddress;
        this.provider = provider;
        
        // TODO: Find from token list
        this.base = {} as TokenInfo;
        this.quote = {} as TokenInfo;

        if (performAllowanceAndBalanceCheck) {
            this.performAllowanceAndBalanceCheck();
        }
    }
    
    performAllowanceAndBalanceCheck() {
        /// Verify permit 2 allowances and balances are correct for a given chainID
    }
}