import { DutchOrder } from "@rubicondefi/gladius-sdk";
import { BigNumber } from "ethers/lib/ethers";
import { formatUnits } from "ethers/lib/utils";
import { GenericOrderWithData, ORDER_STATUS } from "../types/rubicon";
import { tokenList } from "../config/tokens";
import { TokenInfo } from "@uniswap/token-lists";


export function getTokenDecimals(tokenAddress: string, chainId: number): number {
    const token = tokenList.tokens.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase() && t.chainId === chainId);
    if (!token) {
        throw new Error(`Token ${tokenAddress} not found in provided list.`);
    }
    return token.decimals;
};

export function getTokenInfoFromAddress(tokenAddress: string, chainId: number) {
    const token = tokenList.tokens.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase() && t.chainId === chainId);
    if (!token) {
        throw new Error(`Token ${tokenAddress} not found in provided list.`);
    }
    return token;
}

export function parseOrders(chainID: number, orders: any[], baseToken: string, quoteToken: string, isAsk: boolean): GenericOrderWithData[] {
    const tokenDecimals = getTokenDecimals(baseToken, chainID);
    const quoteDecimals = getTokenDecimals(quoteToken, chainID);

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

export function getUSDfromCB(token: TokenInfo): Promise<number | undefined> {
    return getSymbolCurrentPriceUSDfromCB(token.symbol);
}

// https://docs.cloud.coinbase.com/sign-in-with-coinbase/docs/api-prices
export function getSymbolCurrentPriceUSDfromCB(symbol: string): Promise<number | undefined> {
    // Need to transform the symbol
    const transformedSymbol = transformSymbol(symbol.toUpperCase());

    if (transformedSymbol === 'USD') {
        return Promise.resolve(1.0);
    }
  
    return fetch(`https://api.coinbase.com/v2/prices/${transformedSymbol}-USD/spot`)
      .then((res) => res.json())
      .then((data: any) => parseFloat(data.data.amount));
  }
  
  // TODO: ALSO IN GLADIUS ORDER FORM NEEDS TO BE A GLOBAL UTIL
  const transformSymbol = (symbol: string) => {
    switch (symbol.toUpperCase()) {
      case 'WETH':
        return 'ETH';
      case 'CBETH':
        return 'ETH';
      case 'TEST':
        return 'ETH';
      case 'WMATIC':
        return 'MATIC';
      case 'USDC':
        return 'USD';
      case 'USDBC':
        return 'USD';
      case 'USDC.E':
        return 'USD';
      case 'WBTC':
        return 'BTC';
      default:
        return symbol;
    }
  };
  
