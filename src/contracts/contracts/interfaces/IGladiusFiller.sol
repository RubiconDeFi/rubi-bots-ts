// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IGladiusFiller
 * @notice Interface for modular Gladius order fillers
 * @dev This interface allows for a future meta contract to aggregate multiple fillers
 */
interface IGladiusFiller {
    /**
     * @notice Fill a Gladius order using the specific aggregator
     * @param orderHash The hash of the Gladius order (for tracking)
     * @param order The abi-encoded GladiusOrder
     * @param sig The order signature
     * @param quantity The quantity to fill (for partial fills)
     * @param swapData The aggregator-specific swap calldata (to source tokens for arbitrage leg)
     * @param minETHReturn Minimum ETH profit required (reverts if not profitable)
     * @param tokenInfo Encoded token addresses: abi.encode(inputToken, outputToken, profitToken)
     * @dev Profit conversion uses on-chain Uniswap (handles variable amounts from Dutch auction decay)
     */
    function fillGladiusOrder(
        bytes32 orderHash,
        bytes memory order,
        bytes memory sig,
        uint256 quantity,
        bytes calldata swapData,
        uint256 minETHReturn,
        bytes calldata tokenInfo
    ) external;

    /**
     * @notice Check if an order has been filled
     * @param orderHash The hash of the Gladius order
     * @return true if the order has been filled
     */
    function isOrderFilled(bytes32 orderHash) external view returns (bool);

    /**
     * @notice Get the name/identifier of this filler (e.g., "0x", "ODOS")
     * @return The filler identifier
     */
    function fillerName() external pure returns (string memory);
}

