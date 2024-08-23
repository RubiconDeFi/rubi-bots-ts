// src/interfaces/MarketVenue.ts

export interface MarketVenue {
    getBestBid(): Promise<number | null>;
    getBestAsk(): Promise<number | null>;
    getMidPointPrice(): Promise<number | null>;
}
