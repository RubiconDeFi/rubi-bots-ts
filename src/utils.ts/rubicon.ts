import { DutchOrder } from "@rubicondefi/gladius-sdk";
import { BigNumber } from "ethers/lib/ethers";
import { formatUnits } from "ethers/lib/utils";
import { GenericOrderWithData, ORDER_STATUS } from "../types/rubicon";
import { tokenList } from "../config/tokens";


export function getTokenDecimals(tokenAddress: string): number {
    const token = tokenList.tokens.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
    if (!token) {
        throw new Error(`Token ${tokenAddress} not found in provided list.`);
    }
    return token.decimals;
};

export function parseOrders(chainID: number, orders: any[], baseToken: string, quoteToken: string, isAsk: boolean): GenericOrderWithData[] {
    const tokenDecimals = getTokenDecimals(baseToken);
    const quoteDecimals = getTokenDecimals(quoteToken);

    return orders
        .filter(order => {
            const decodedOrder = DutchOrder.parse(order.encodedOrder, chainID);
            return order.orderStatus === ORDER_STATUS.OPEN && decodedOrder.info.deadline >= Math.floor(Date.now() / 1000);
        })
        .map(order => {
            const decodedOrder = DutchOrder.parse(order.encodedOrder, chainID);
            const pay = BigNumber.from(order.input.endAmount);
            const buy = BigNumber.from(order.outputs[0].endAmount);

            // Calculate price based on whether it is an ask or a bid
            const formattedPay = formatUnits(pay, isAsk ? tokenDecimals : quoteDecimals);
            const formattedBuy = formatUnits(buy, isAsk ? quoteDecimals : tokenDecimals);
            const price = isAsk ? (parseFloat(formattedBuy) / parseFloat(formattedPay)) : (parseFloat(formattedPay) / parseFloat(formattedBuy));

            // Prepare the order data with all relevant fields
            return {
                size: isAsk ? parseFloat(formattedPay) : parseFloat(formattedBuy),
                price: price,
                hash: order.orderHash,
                signature: order.signature,
                nonce: decodedOrder.info.nonce.toString(),
                deadline: decodedOrder.info.deadline,
                owner: order.outputs[0].recipient,
                data: decodedOrder  // Including the entire decoded order for additional context
            };
        });
}
