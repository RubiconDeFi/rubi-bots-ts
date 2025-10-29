// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.20;

/// @notice Minimal interface for GladiusReactor
/// @dev Based on Gladius protocol contracts
interface IGladiusReactor {
    /// @notice Execute a signed order with a callback
    /// @param order The signed order (abi-encoded GladiusOrder + signature)
    /// @param quantity The quantity to fill (for partial fills)
    /// @param callbackData Additional data to pass to callback
    function executeWithCallback(
        bytes memory order,
        bytes memory sig,
        uint256 quantity,
        bytes calldata callbackData
    ) external payable;
}

