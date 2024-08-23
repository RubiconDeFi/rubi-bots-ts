//// TODO: CLEAN UP - MESSY PASTE
import { OrderType } from "@rubicondefi/gladius-sdk";
import { TokenList } from "@uniswap/token-lists";

export enum Network {
    MAINNET = 1,
    GOERLI = 5,
    OPTIMISM_KOVAN = 69,
    OPTIMISM_GOERLI = 420,
    OPTIMISM_MAINNET = 10,
    POLYGON_MAINNET = 137,
    POLYGON_MUMBAI = 80001,
    ARBITRUM_MAINNET = 42161,
    ARBITRUM_GOERLI = 421613,
    ARBITRUM_SEPOLIA = 421614,
    ERROR = 0,
    BASE_MAINNET = 8453
};


// TODO: Extraploate to constants?

// Input tokens 
export const tokenList: TokenList = {
    name: 'Rubicon Token List',
    timestamp: new Date().toISOString(),
    version: {
        major: 1,
        minor: 0,
        patch: 0,
    },
    tokens: [
        // ** V1 MAINNET **
        // ** QUOTES **
        // ** V1 MAINNET **
        {
            name: 'USDC Stablecoin',
            symbol: 'USDC',
            chainId: Network.OPTIMISM_MAINNET,
            address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
            decimals: 6,
        },
        // ** QUOTES **
        {
            name: 'USDC.e Stablecoin',
            symbol: 'USDC.e',
            chainId: Network.OPTIMISM_MAINNET,
            address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
            decimals: 6,
            // logoURI: `${TokenImages['USDCLogo']}`,
            extensions: {
                quote: true,
                underlyingAssetGeckoID: 'usd-coin',
            },
        },
        {
            name: 'DAI Stablecoin',
            symbol: 'DAI',
            chainId: Network.OPTIMISM_MAINNET,
            address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
            decimals: 18,
            extensions: {
                quote: true,
                underlyingAssetGeckoID: 'dai',
            },
        },
        {
            name: 'USDT Stablecoin',
            symbol: 'USDT',
            chainId: Network.OPTIMISM_MAINNET,
            address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            decimals: 6,
            extensions: {
                quote: true,
                underlyingAssetGeckoID: 'tether',
            },
        },
        {
            symbol: 'WETH',
            name: 'Wrapped Ethereum',
            decimals: 18,
            address: '0x4200000000000000000000000000000000000006',
            chainId: Network.OPTIMISM_MAINNET,
            extensions: {
                underlyingAssetGeckoID: 'ethereum',
            },
        },
        {
            symbol: 'OP',
            name: 'Optimism',
            decimals: 18,
            address: '0x4200000000000000000000000000000000000042',
            chainId: Network.OPTIMISM_MAINNET,
            extensions: {
                unsupportedQuotes: {
                    USDT: true,
                    DAI: true,
                },
                underlyingAssetGeckoID: 'optimism',
            },
        },
        {
            symbol: 'WBTC',
            name: 'Wrapped Bitcoin',
            decimals: 8,
            address: '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
            chainId: Network.OPTIMISM_MAINNET,
            extensions: {
                unsupportedQuotes: {
                    USDT: true,
                    DAI: true,
                },
                underlyingAssetGeckoID: 'wrapped-bitcoin',
            },
        },
        {
            symbol: 'SNX',
            name: 'Synthetix',
            decimals: 18,
            address: '0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4',
            chainId: Network.OPTIMISM_MAINNET,
            extensions: {
                unsupportedQuotes: {
                    USDT: true,
                    DAI: true,
                },
                underlyingAssetGeckoID: 'havven',
            },
        },
        // *** NOTE THIS IS FAKE AND CANT ACTUALLY WRAP CAUSING ISSUES ON WRAP/UNWRAP as it cannot wrap/unwrap... Simply mint via faucet()
        {
            symbol: 'WETH',
            name: 'Wrapped Ethereum',
            decimals: 18,
            address: '0x54e63385c13ECbE3B859991eEdad539d9fDa1167', // '0x4200000000000000000000000000000000000006'
            chainId: Network.OPTIMISM_GOERLI,
            extensions: {
                underlyingAssetGeckoID: 'ethereum',
                isNativeAssetWrapper: true,
            },
        },
        {
            name: 'Tether',
            symbol: 'USDT',
            chainId: Network.OPTIMISM_GOERLI,
            address: '0xD70734Ba8101Ec28b38AB15e30Dc9b60E3c6f433',
            decimals: 18,
            extensions: {
                quote: true,
                underlyingAssetGeckoID: 'usd-coin',
            },
        },

        {
            address: '0x45FA7d7b6C954d17141586e1BD63d2e35d3e26De',
            chainId: Network.OPTIMISM_GOERLI,
            symbol: 'F',
            extensions: {
                underlyingAssetGeckoID: 'optimism',
            },
            decimals: 18,
            name: 'Forrest Coin',
        },

        {
            address: '0xCeE7148028Ff1B08163343794E85883174a61393',
            chainId: Network.OPTIMISM_GOERLI,
            symbol: 'OP',
            extensions: {
                underlyingAssetGeckoID: 'optimism',
                rewardsLive: false,
            },
            decimals: 18,
            name: 'Optimism',
        },
        {
            name: 'USDC Stablecoin',
            symbol: 'USDC',
            chainId: Network.OPTIMISM_GOERLI,
            address: '0xe432f229521eE954f80C83257485405E3d848d17',
            decimals: 18,
            extensions: {
                quote: true,
                underlyingAssetGeckoID: 'usd-coin',
            },
        },
        {
            address: '0x25bC01c78Ac1dD2Ce2e78E29E0a225a341Cd906A',
            chainId: Network.OPTIMISM_GOERLI,
            symbol: 'TEST',
            name: 'TEST',
            decimals: 18,
        },
        // Mumbai testing
        {
            address: "0xcC5f8571D858DAD7fA2238FB9df4Ad384493013C",
            chainId: Network.POLYGON_MUMBAI,
            symbol: "USDC",
            decimals: 18,
            name: "USDC Stablecoin",
        },
        {
            address: "0x6aeda41c98ab5399044fc36162B57d39c13b658a",
            chainId: Network.POLYGON_MUMBAI,
            symbol: "TEST",
            decimals: 18,
            name: "Test Coin",
        },
        /// *** ARBITRUM MAINNET ***
        {
            name: 'Wrapped Ethereum',
            symbol: 'WETH',
            chainId: Network.ARBITRUM_MAINNET,
            address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
            decimals: 18,
            extensions: {
                underlyingAssetGeckoID: 'ethereum',
                isNativeAssetWrapper: true,
            },
        },
        {
            name: 'USDC Stablecoin',
            symbol: 'USDC',
            chainId: Network.ARBITRUM_MAINNET,
            address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
            decimals: 6,
            extensions: {
                quote: true,
            },
        },
        {
            name: 'Bridged USDC Stablecoin',
            symbol: 'USDC.e',
            chainId: Network.ARBITRUM_MAINNET,
            address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
            decimals: 6,
            extensions: {
                quote: true,
            },
        },
        {
            name: 'DAI Stablecoin',
            symbol: 'DAI',
            chainId: Network.ARBITRUM_MAINNET,
            address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
            decimals: 18,
            extensions: {
                quote: true,
            },
        },
        {
            name: 'Tether',
            symbol: 'USDT',
            chainId: Network.ARBITRUM_MAINNET,
            address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
            decimals: 6,
            extensions: {
                quote: true,
            },
        },
        {
            name: 'Wrapped BTC',
            symbol: 'WBTC',
            chainId: Network.ARBITRUM_MAINNET,
            address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
            decimals: 8,
        },
        {
            name: 'Arbitrum',
            symbol: 'ARB',
            chainId: Network.ARBITRUM_MAINNET,
            address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
            decimals: 18,
        },


        // ARBITRUM GOERLI 
        {
            address: "0x175A6D830579CAcf1086ECC718fAB2A86b12e0D3",
            chainId: Network.ARBITRUM_GOERLI,
            symbol: "WETH",
            decimals: 18,
            name: "Wrapped Ether",
        },
        {
            address: "0xb37b4399880AfEF7025755d65C193363966b8b89",
            chainId: Network.ARBITRUM_GOERLI,
            symbol: "DAI",
            decimals: 18,
            name: "Dai Stablecoin",
        },
        {
            address: "0x34cB584d2E4f3Cd37e93A46A4C754044085439b4",
            chainId: Network.ARBITRUM_GOERLI,
            symbol: "USDC",
            decimals: 18,
            name: "USDC Stablecoin",
        },
        {
            address: "0x6ABc1231d85D422c9Fe25b5974B4C0D4AB85d9b5",
            chainId: Network.ARBITRUM_GOERLI,
            symbol: "USDT",
            decimals: 18,
            name: "Tether",
        },
        {
            address: "0x710c1A969cbC8ab5644571697824c655ffBDE926",
            chainId: Network.ARBITRUM_GOERLI,
            symbol: "WBTC",
            decimals: 18,
            name: "Wrapped Bitcoin",
        },
        {
            address: "0x83250b2783554D4D401c45c39fF8A161dE44BC15",
            chainId: Network.ARBITRUM_GOERLI,
            symbol: "TEST",
            decimals: 18,
            name: "Test Coin",
        },

        // *** BASE MAINNET ***
        {
            name: 'Wrapped Ether',
            symbol: 'WETH',
            chainId: Network.BASE_MAINNET,
            address: '0x4200000000000000000000000000000000000006',
            decimals: 18,
        },
        {
            name: 'USD Base Coin',
            symbol: 'USDC',
            chainId: Network.BASE_MAINNET,
            address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
            decimals: 6,
            extensions: {
                quote: true,
            },
        },
        {
            name: 'Coinbase Wrapped Staked ETH',
            symbol: 'cbETH',
            chainId: Network.BASE_MAINNET,
            address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
            decimals: 18,
        },
        {
            name: 'Dai Stablecoin',
            symbol: 'DAI',
            chainId: Network.BASE_MAINNET,
            address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
            decimals: 18,
            extensions: {
                quote: true,
            },
        },
        {
            name: 'USDC Stablecoin',
            symbol: 'USDC',
            chainId: Network.ARBITRUM_SEPOLIA,
            address: '0xd28301B86800bBCF1f09a55642ee3E115Edb1f67',
            decimals: 18,
            extensions: {
                quote: true,
            },
        },
        {
            name: 'Test Token', // CAN PRETEND THIS IS PEPE!
            symbol: 'TEST',
            chainId: Network.ARBITRUM_SEPOLIA,
            address: '0x2fc8011B01c988249ace25ec2c624079ac146e04',
            decimals: 18,
        },
        {
            name: 'Brett Coin',
            symbol: 'BRETT',
            chainId: Network.BASE_MAINNET,
            // logoURI: `${TokenImages['BRETTLogo']}`,
            address: '0x532f27101965dd16442E59d40670FaF5eBB142E4',
            decimals: 18,
            extensions: {
                referenceVenue: 'univ3',
                referenceVenueQuote: 'WETH',
                referenceVenueFeeTier: process.env['BRETT_BASE_MAINNET_RVFT'] || '10000',
            },
        },
        {
            name: 'Wrapped Ether',
            symbol: 'WETH',
            chainId: Network.BASE_MAINNET,
            // logoURI: `${TokenImages['WETHLogo']}`,
            address: '0x4200000000000000000000000000000000000006',
            decimals: 18,
            extensions: {
                underlyingAssetGeckoID: 'ethereum',
                isNativeAssetWrapper: true,
            },
        },
        {
            name: 'USD Base Coin',
            symbol: 'USDbC',
            chainId: Network.BASE_MAINNET,
            // logoURI: `${TokenImages['USDCLogo']}`, // TODO: update to USDbC logo
            address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
            decimals: 6,
            extensions: {
                quote: true,
            },
        },
        // *** Ethereum Mainnet

        {
            name: 'Wrapped Ethereum',
            symbol: 'WETH',
            chainId: Network.MAINNET,
            address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            decimals: 18,
            // logoURI: `${TokenImages['WETHLogo']}`,
            extensions: {
                underlyingAssetGeckoID: 'ethereum',
                isNativeAssetWrapper: true,
            },
        },
        {
            name: 'USDC Stablecoin',
            symbol: 'USDC',
            chainId: Network.MAINNET,
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            decimals: 6,
            // logoURI: `${TokenImages['USDCLogo']}`,
            extensions: {
                quote: true,
            },
        },
        {
            name: 'DAI Stablecoin',
            symbol: 'DAI',
            chainId: Network.MAINNET,
            address: '0x6b175474e89094c44da98b954eedeac495271d0f',
            decimals: 18,
            // logoURI: `${TokenImages['DAILogo']}`,
            extensions: {
                quote: true,
            },
        },
        {
            name: 'Tether',
            symbol: 'USDT',
            chainId: Network.MAINNET,
            address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            decimals: 6,
            // logoURI: `${TokenImages['USDTLogo']}`,
            extensions: {
                quote: true,
            },
        },
        {
            name: 'Wrapped BTC',
            symbol: 'WBTC',
            chainId: Network.MAINNET,
            address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
            decimals: 8,
            // logoURI: `${TokenImages['WBTCLogo']}`,
        },
        // TODO: Plug in most liquid pair...
        {
            name: 'Synthetix Network Token',
            symbol: 'SNX',
            chainId: Network.MAINNET,
            address: '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
            decimals: 18,
            // logoURI: `${TokenImages['SNXLogo']}`,
            extensions: {
                referenceVenue: 'univ3',
                referenceVenueQuote: 'WETH',
                referenceVenueFeeTier: '3000',
            },
        },
        {
            name: 'Uniswap',
            symbol: 'UNI',
            chainId: Network.MAINNET,
            address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
            decimals: 18,
            // logoURI: `${TokenImages['UNILogo']}`,
            extensions: {
                referenceVenue: 'univ3',
                referenceVenueQuote: 'WETH',
                referenceVenueFeeTier: '3000',
            },
        },
        {
            name: 'ChainLink Token',
            symbol: 'LINK',
            chainId: Network.MAINNET,
            address: '0x514910771af9ca656af840dff83e8264ecf986ca',
            decimals: 18,
            // logoURI: `${TokenImages['LINKLogo']}`,
            extensions: {
                referenceVenue: 'univ3',
                referenceVenueQuote: 'WETH',
                referenceVenueFeeTier: '3000',
            },
        },
        {
            name: 'Aave Token',
            symbol: 'AAVE',
            chainId: Network.MAINNET,
            address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
            decimals: 18,
            // logoURI: `${TokenImages['AAVELogo']}`,
            extensions: {
                referenceVenue: 'univ3',
                referenceVenueQuote: 'WETH',
                referenceVenueFeeTier: '3000',
            },
        },
        {
            name: 'Compound',
            symbol: 'COMP',
            chainId: Network.MAINNET,
            address: '0xc00e94cb662c3520282e6f5717214004a7f26888',
            decimals: 18,
            // logoURI: `${TokenImages['COMPLogo']}`,
            extensions: {
                referenceVenue: 'univ3',
                referenceVenueQuote: 'WETH',
                referenceVenueFeeTier: '3000',
            },
        },
        {
            name: 'Maker',
            symbol: 'MKR',
            chainId: Network.MAINNET,
            address: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
            decimals: 18,
            // logoURI: `${TokenImages['MKRLogo']}`,
            extensions: {
                referenceVenue: 'univ3',
                referenceVenueQuote: 'WETH',
                referenceVenueFeeTier: '3000',
            },
        },
        {
            name: 'SHIBA INU',
            symbol: 'SHIB',
            chainId: Network.MAINNET,
            address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
            decimals: 18,
            // logoURI: `${TokenImages['SHIBLogo']}`,
            extensions: {
                referenceVenue: 'univ3',
                referenceVenueQuote: 'WETH',
                referenceVenueFeeTier: '3000',
            },
        },
        {
            name: 'Ondo Finance',
            symbol: 'ONDO',
            chainId: Network.MAINNET,
            address: '0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3',
            decimals: 18,
            // logoURI: `${TokenImages['ONDOLogo']}`,
            extensions: {
                referenceVenue: 'univ3',
                referenceVenueQuote: 'WETH',
                referenceVenueFeeTier: '3000',
            },
        },
    ],
};

// Permit 2 addresses
export const permit2addresses: { [chainId: number]: string } = {
    [Network.ARBITRUM_GOERLI]: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    [Network.MAINNET]: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    [Network.OPTIMISM_MAINNET]: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    [Network.ARBITRUM_SEPOLIA]: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    [Network.BASE_MAINNET]: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    [Network.ARBITRUM_MAINNET]: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
}

// reactor addresses
export const reactorAddresses: { [chainId: number]: string } = {
    [Network.OPTIMISM_MAINNET]: "0x98169248bDf25E0e297EA478Ab46ac24058Fac78", //"0xcB23e6c82c900E68d6F761bd5a193a5151A1D6d2",
    [Network.ARBITRUM_GOERLI]: '0xa7C007078CbEB6E0DF56A117752b4f44f4F93187', //'0x8D228f8A5C78F82E8300244497114BC482F6c213', // NEW ONE
    [Network.ARBITRUM_SEPOLIA]: '0x1456a1897509Bb9A42610d8fF5FE869D2612C181',
    [Network.BASE_MAINNET]: '0x3C53c04d633bec3fB0De3492607C239BF92d07f9',
    [Network.ARBITRUM_MAINNET]: '0x6D81571B4c75CCf08bD16032D0aE54dbaff548b0',
    [Network.MAINNET]: '0x3C53c04d633bec3fB0De3492607C239BF92d07f9',
}

// quoter addresses
export const quoterContracts: { [chainId: number]: string } = {
    [Network.ARBITRUM_GOERLI]: '0xf91dA8728Ff16e044C8cea5281613F33aE4D24f8' // '0x3DE6B223DE796aBe6590d927B47A37dCF6d2771e'// '0x3DE6B223DE796aBe6590d927B47A37dCF6d2771e'// limit order // "0x77978ca9E4Fef774C8F493A776Bcf6e274940427",
}

type Reactors = {
    [OrderType.Dutch]: string;
};

// Hacky order minimum hardcode, could be better?
// Mapping used in min order sizes
export const MIN_ORDER_SIZES: Record<string, number> = {
    WETH: 0.0022,
    TEST: 0.0022, // Dummy token to mimic WETH...
    DAI: 5,
    USDC: 5,
    USDT: 5,
    USDbC: 5,
    WBTC: 0.00015,
    ARB: 4,
    OP: 3,
};

