import { ethers, BigNumber } from 'ethers';
import axios from 'axios';
import { formatUnits } from 'ethers/lib/utils';
import { DutchOrder } from '@rubicondefi/gladius-sdk'; // Assuming DutchOrder is imported from Gladius SDK
import { GenericOrderWithData } from '../types/rubicon'; // Import your interface
import { parseOrders } from '../utils.ts/rubicon';
import { GLADIUS } from '../config/rubicon';

export class RubiconBookTracker {
    chainID: number;
    userAddress: string | undefined;
    baseAddress: string;
    quoteAddress: string;
    book: { asks: GenericOrderWithData[]; bids: GenericOrderWithData[] };
    userBook: { asks: GenericOrderWithData[]; bids: GenericOrderWithData[] };

    constructor(
        chainID: number,
        userAddress: string | undefined, // If not defined, just get the whole book
        baseAddress: string,
        quoteAddress: string,
    ) {
        this.chainID = chainID;
        this.userAddress = userAddress;
        this.baseAddress = baseAddress;
        this.quoteAddress = quoteAddress;
        this.book = { asks: [], bids: [] }; // Initialize empty book
        this.userBook = { asks: [], bids: [] }; // Initialize empty user book
    }

    // Fetch the entire order book for a specific pair and depth (optional)
    async fetchOrderBook(depth: number = 50): Promise<{ asks: GenericOrderWithData[], bids: GenericOrderWithData[] }> {
        const asksUrl = `${GLADIUS}/dutch-auction/orders?chainId=${this.chainID}&orderStatus=open&buyToken=${this.quoteAddress}&sellToken=${this.baseAddress}&limit=${depth}&asc=true&sortKey=price`;
        const bidsUrl = `${GLADIUS}/dutch-auction/orders?chainId=${this.chainID}&orderStatus=open&buyToken=${this.baseAddress}&sellToken=${this.quoteAddress}&limit=${depth}&desc=true&sortKey=price`;

        try {
            const [asks, bids] = await Promise.all([this.fetchAllOrders(asksUrl), this.fetchAllOrders(bidsUrl)]);
            
            const parsedAsks = parseOrders(this.chainID, asks, this.baseAddress, this.quoteAddress, true);
            const parsedBids = parseOrders(this.chainID, bids, this.baseAddress, this.quoteAddress, false);

            // Store the book
            this.book = { asks: parsedAsks, bids: parsedBids };

            // If userAddress is provided, filter the orders to find those placed by the user
            if (this.userAddress) {
                this.userBook.asks = parsedAsks.filter(order => order.owner.toLowerCase() === this.userAddress!.toLowerCase());
                this.userBook.bids = parsedBids.filter(order => order.owner.toLowerCase() === this.userAddress!.toLowerCase());
            }

            return this.book;
        } catch (error) {
            console.error(`Error fetching order book for chainId: ${this.chainID}:`, error);
            throw error;
        }
    }

    // Get user-specific order book (asks and bids)
    getUserBook(): { asks: GenericOrderWithData[], bids: GenericOrderWithData[] } {
        if (!this.userAddress) {
            throw new Error("User address not provided. Cannot retrieve user-specific orders.");
        }

        return this.userBook;
    }

    // Function to handle pagination and fetch all orders (handles cursors)
    private async fetchOrdersWithCursor(url: string, cursor?: string): Promise<{ orders: any[], cursor?: string }> {
        const cursorParam = cursor ? `&cursor=${cursor}` : '';
        const fullUrl = `${url}${cursorParam}`;
        try {
            const response = await axios.get(fullUrl);
            return response.data;
        } catch (error) {
            console.error(`Error fetching orders from ${fullUrl}:`, error);
            return { orders: [] };
        }
    }

    // Recursive function to fetch all orders with pagination
    private async fetchAllOrders(url: string): Promise<any[]> {
        let allOrders: any[] = [];
        let cursor: string | undefined;

        while (true) {
            const { orders, cursor: newCursor } = await this.fetchOrdersWithCursor(url, cursor);
            allOrders = allOrders.concat(orders);
            if (!newCursor || orders.length === 0) {
                break;
            }
            cursor = newCursor;
        }

        return allOrders;
    }

    // Get the best bid price from the book
    async getBestBid(): Promise<number | null> {
        if (!this.book.bids.length) {
            await this.fetchOrderBook();
        }
        return this.book.bids.length > 0 ? this.book.bids[0].price : null;
    }

    // Get the best ask price from the book
    async getBestAsk(): Promise<number | null> {
        if (!this.book.asks.length) {
            await this.fetchOrderBook();
        }
        return this.book.asks.length > 0 ? this.book.asks[0].price : null;
    }

    // Calculate and return the midpoint price
    async getMidPointPrice(): Promise<number | null> {
        const bestBid = await this.getBestBid();
        const bestAsk = await this.getBestAsk();

        if (bestBid === null || bestAsk === null) {
            return null;
        }

        return (bestBid + bestAsk) / 2;
    }

    // Polling the Rubicon order book periodically
    pollForBookUpdates(interval: number = 1000) {
        setInterval(async () => {
            try {
                await this.fetchOrderBook();
                console.log("Updated order book:", this.book);
            } catch (error) {
                console.error("Error polling Rubicon book:", error);
            }
        }, interval);
    }
}
