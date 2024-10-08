export interface GenericOrderWithData {
    size: number;
    price: number;
    data: any; // Customize as per your data structure
    hash: string;
    signature: string;
    nonce: number | string;
    deadline: number; // in seconds
    owner: string;
}

export enum ORDER_STATUS {
    OPEN = 'open',
    EXPIRED = 'expired',
    ERROR = 'error',
    CANCELLED = 'cancelled',
    FILLED = 'filled',
    INSUFFICIENT_FUNDS = 'insufficient-funds',
}

export type SimpleBook = {
    bids: GenericOrder[];
    asks: GenericOrder[];
  };
  
  export type GenericOrder = {
    price: number;
    size: number;
  };
  
  export type Call = {
    target: string;
    function: string; //bytes ** CAN BE SOMETHING LIKE getBalance()
    args: string[] | any[];
  };
  