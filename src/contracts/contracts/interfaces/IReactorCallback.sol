// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Struct definitions matching gladius-protocol/src/base/ReactorStructs.sol
/// @dev Copied locally to avoid import path issues with Hardhat

struct OrderInfo {
    address reactor; // IReactor cast to address
    address swapper;
    uint256 nonce;
    uint256 deadline;
    address additionalValidationContract;
    bytes additionalValidationData;
}

struct InputToken {
    address token; // ERC20 cast to address
    uint256 amount;
    uint256 maxAmount; // For Dutch orders
}

struct OutputToken {
    address token;
    uint256 amount;
    address recipient;
}

struct ResolvedOrder {
    OrderInfo info;
    InputToken input;
    OutputToken[] outputs;
    bytes sig;
    bytes32 hash;
}

/// @notice Callback interface for Gladius reactor execution
/// @dev Matches the actual IReactorCallback from gladius-protocol
interface IReactorCallback {
    /// @notice Called by the reactor during order execution
    /// @param resolvedOrders The resolved orders with calculated amounts (actual structs, not encoded bytes)
    /// @param callbackData The callback data passed from executeWithCallback
    /// @dev Must execute swap and provide output tokens to reactor
    function reactorCallback(
        ResolvedOrder[] memory resolvedOrders,
        bytes memory callbackData
    ) external;
}

