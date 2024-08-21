/// Strategy that targets a CEX market and places orders on Rubicon depending on the CEXs liquidity curve
import { ethers } from "ethers";
import { RubiconConnector } from "../../connectors/rubicon";
import { KrakenReferenceVenue } from "../../referenceVenues/kraken";
import { RubiconBookTracker } from "../../referenceVenues/rubicon";

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

    // Rubicon Connector Instance
    rubiconConnector: RubiconConnector;
    referenceVenueConnector: any; // TODO: add connector interface
    rubiconBookWatcher: RubiconBookTracker;
    walletWithProvider: ethers.Wallet;

    constructor(
        chainID: number,
        walletWithProvider: ethers.Wallet,
        userAddress: string,
        baseAddress: string,
        quoteAddress: string,
        performAllowanceAndBalanceCheck: boolean = true,
        referenceCEXVenue: string,
        referenceCEXBaseTicker: string,
        referenceCEXQuoteTicker: string,
        // TODO: Add more config options like levels, min/max spread, etc.
    ) {
        this.chainID = chainID;
        this.userAddress = userAddress;
        this.baseAddress = baseAddress;
        this.quoteAddress = quoteAddress;
        this.provider = walletWithProvider.provider;
        this.referenceCEXBaseTicker = referenceCEXBaseTicker;
        this.referenceCEXQuoteTicker = referenceCEXQuoteTicker;
        this.walletWithProvider = walletWithProvider;

        this.rubiconConnector = new RubiconConnector(
            chainID,
            walletWithProvider,
            userAddress,
            baseAddress,
            quoteAddress,
            performAllowanceAndBalanceCheck,
        );

        console.log("CEX Market Making Strategy Initialized");
        if (referenceCEXVenue.toLowerCase() === "kraken") {
            console.log("Reference CEX Venue is Kraken");
            this.referenceVenueConnector = new KrakenReferenceVenue(referenceCEXBaseTicker, referenceCEXQuoteTicker);
        }

        this.rubiconBookWatcher = new RubiconBookTracker(
            chainID,
            userAddress,
            baseAddress,
            quoteAddress,
        );
    }

    async runStrategy() {
        /// Run the strategy
        console.log("Running CEX Market Making Strategy");
        const test = await this.referenceVenueConnector.getBestBid();
        console.log("Best Bid from CEX: ", test);


        const obTest = await this.rubiconBookWatcher.fetchOrderBook();
        console.log("Order Book from Rubicon: ", obTest);
        
    }
}