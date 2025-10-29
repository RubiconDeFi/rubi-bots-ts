// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Contract addresses for 0x and Gladius on different chains
/// @dev Hardcoded addresses based on official deployments
library Addresses {
    // 0x AllowanceHolder addresses
    // Cancun hardfork chains (Base, Optimism, Arbitrum, Ethereum, etc.)
    address public constant ALLOWANCE_HOLDER_CANCUN = 0x0000000000001fF3684f28c67538d4D072C22734;
    
    // Shanghai hardfork chains (Mantle, Taiko)
    address public constant ALLOWANCE_HOLDER_SHANGHAI = 0x0000000000005E88410CcDFaDe4a5EfaE4b49562;
    
    // London hardfork chains (Linea)
    address public constant ALLOWANCE_HOLDER_LONDON = 0x000000000000175a8b9bC6d539B3708EEd92EA6c;

    // Base chain addresses
    address public constant BASE_GLADIUS_REACTOR = 0x3C53c04d633bec3fB0De3492607C239BF92d07f9;
    address public constant BASE_GLADIUS_QUOTER = 0x56e43695d183dcFa9D8fE95E796227A491627Fd9;
    address public constant BASE_FEE_CONTROLLER = 0x72826Cd3c3040e00F2D831d835b1554Ec02ef58a;
    address public constant BASE_ALLOWANCE_HOLDER = ALLOWANCE_HOLDER_CANCUN; // Base supports Cancun
    address public constant BASE_UNISWAP_V2_ROUTER = 0x4752BA5dbc23f51D1f8d5E02CcE40C125D1240D4; // Uniswap V2 Router on Base

    // Optimism chain addresses
    address public constant OPTIMISM_GLADIUS_REACTOR = 0x98169248bDf25E0e297EA478Ab46ac24058Fac78;
    address public constant OPTIMISM_GLADIUS_QUOTER = 0x9244aeAE36f34d63244EDCF9fdb58C03cE4Ce12d;
    address public constant OPTIMISM_FEE_CONTROLLER = 0xD376b6BAb4c5dA3Cd83DD49A346b3D432385724E;
    address public constant OPTIMISM_ALLOWANCE_HOLDER = ALLOWANCE_HOLDER_CANCUN;

    // Arbitrum chain addresses
    address public constant ARBITRUM_GLADIUS_REACTOR = 0x6D81571B4c75CCf08bD16032D0aE54dbaff548b0;
    address public constant ARBITRUM_GLADIUS_QUOTER = 0x9244aeAE36f34d63244EDCF9fdb58C03cE4Ce12d;
    address public constant ARBITRUM_FEE_CONTROLLER = 0xB6efa81466ab4A93129245bD2aAA535280F7ADbB;
    address public constant ARBITRUM_ALLOWANCE_HOLDER = ALLOWANCE_HOLDER_CANCUN;

    // Ethereum chain addresses
    address public constant ETHEREUM_GLADIUS_REACTOR = 0x3C53c04d633bec3fB0De3492607C239BF92d07f9;
    address public constant ETHEREUM_GLADIUS_QUOTER = 0x56e43695d183dcFa9D8fE95E796227A491627Fd9;
    address public constant ETHEREUM_FEE_CONTROLLER = 0xCd4b4242F09f518A18156B6b46a35c5B96A73d3e;
    address public constant ETHEREUM_ALLOWANCE_HOLDER = ALLOWANCE_HOLDER_CANCUN;

    /// @notice Get the AllowanceHolder address for a given chain ID
    /// @param chainId The chain ID
    /// @return The AllowanceHolder address
    function getAllowanceHolder(uint256 chainId) external pure returns (address) {
        // Cancun chains: Ethereum (1), Base (8453), Optimism (10), Arbitrum (42161), Polygon (137), etc.
        if (
            chainId == 1 ||      // Ethereum Mainnet
            chainId == 8453 ||   // Base
            chainId == 10 ||     // Optimism
            chainId == 42161 ||  // Arbitrum
            chainId == 137       // Polygon
        ) {
            return ALLOWANCE_HOLDER_CANCUN;
        }
        
        // Shanghai chains: Mantle (5000), Taiko (167000)
        if (chainId == 5000 || chainId == 167000) {
            return ALLOWANCE_HOLDER_SHANGHAI;
        }
        
        // London chains: Linea (59144)
        if (chainId == 59144) {
            return ALLOWANCE_HOLDER_LONDON;
        }
        
        // Default to Cancun for unknown chains
        return ALLOWANCE_HOLDER_CANCUN;
    }
}

