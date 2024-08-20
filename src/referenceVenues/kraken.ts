import { Kraken } from 'node-kraken-api';
import { MarketVenue } from '../types/MarketVenue';

export class KrakenReferenceVenue implements MarketVenue {
    private pair: string;
    private kraken: Kraken;

    constructor(baseSymbol: string, quoteSymbol: string) {
        this.kraken = new Kraken();
        this.pair = this.convertToKrakenPair(baseSymbol, quoteSymbol);
        console.log("ths pair is ", this.pair);
        
    }

    // Convert base/quote symbols to Kraken pair format
    private convertToKrakenPair(baseSymbol: string, quoteSymbol: string): string {
        console.log("baseSymbol is ", baseSymbol);
        console.log("quoteSymbol is ", quoteSymbol);
        
        const krakenBase = this.convertSymbolToKraken(baseSymbol);
        const krakenQuote = this.convertSymbolToKraken(quoteSymbol);

        return `${krakenBase}${krakenQuote}`;
    }

    // Map common symbols to Kraken's notation
    private convertSymbolToKraken(symbol: string): string {
        switch (symbol.toUpperCase()) {
            case 'ETH':
                return 'XETH';
            case 'USD':
                return 'ZUSD';
            case 'BTC':
                return 'XXBT';
            // Add more symbol mappings as needed
            default:
                return symbol;
        }
    }

    // Fetch price data from Kraken using the Kraken node package
    private async fetchKrakenPriceData() {
        try {
            const response = await this.kraken.ticker({ pair: this.pair });
            if (!response || !response[this.pair]) {
                throw new Error(`No data available for the pair: ${this.pair}`);
            }

            // console.log(`Fetched price data from Kraken for pair ${this.pair} `, response);


            return response[this.pair];
        } catch (error) {
            console.error(`Error fetching price data from Kraken: ${error}`);
            throw error;
        }
    }

    // Get the best bid price
    public async getBestBid(): Promise<number | null> {
        try {
            const data: any = await this.fetchKrakenPriceData();
            return parseFloat(data.b[0]); // Best bid price
        } catch (error) {
            console.error("Error getting best bid from Kraken:", error);
            return null;
        }
    }

    // Get the best ask price
    public async getBestAsk(): Promise<number | null> {
        try {
            const data: any = await this.fetchKrakenPriceData();
            return parseFloat(data.a[0]); // Best ask price
        } catch (error) {
            console.error("Error getting best ask from Kraken:", error);
            return null;
        }
    }

    // Calculate the mid-point price (average of best bid and best ask)
    public async getMidPointPrice(): Promise<number | null> {
        try {
            const bestBid = await this.getBestBid();
            const bestAsk = await this.getBestAsk();

            if (bestBid === null || bestAsk === null) {
                throw new Error("Unable to calculate mid-point price due to missing data");
            }

            return (bestBid + bestAsk) / 2;
        } catch (error) {
            console.error("Error calculating mid-point price:", error);
            return null;
        }
    }
}
