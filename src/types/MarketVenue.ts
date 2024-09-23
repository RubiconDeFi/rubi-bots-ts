// src/interfaces/MarketVenue.ts

import { SimpleBook } from "./rubicon";

export interface MarketVenue {
    getBestBid(): Promise<number | null>;
    getBestAsk(): Promise<number | null>;
    getMidPointPrice(): Promise<number | null>;
    getBestBidAndAsk(): Promise<SimpleBook | null>;
}
