
export const GLADIUS = "https://gladius.rubicon.finance";

export const MIN_ORDER_SIZES: Record<string, number> = {
    WETH: 0.0022,
    TEST: 0.0022, // Dummy token to mimic WETH...
    DAI: 5,
    USDC: 5,
    "USDC.e": 5,
    USDT: 5,
    USDbC: 5,
    WBTC: 0.00015,
    ARB: 4,
    OP: 3,
};

export const RUBICON_MARKET_ADDRESS_BY_CHAIN_ID: Record<number, string> = {
    42161: "0xc715a30fde987637a082cf5f19c74648b67f2db8",
};