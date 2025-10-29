// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IGladiusFiller.sol";
import "./interfaces/IGladiusReactor.sol";
import "./interfaces/IReactorCallback.sol";
import "./constants/Addresses.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title 0xGladiusFiller
 * @notice Fills Gladius Dutch auction orders via 0x arbitrage
 * @dev This contract:
 *      1. Operator only pays gas (no ETH input required)
 *      2. Executes arbitrage: fills Gladius order via 0x swap
 *      3. Converts all ERC20 profits back to ETH atomically
 *      4. Returns ETH profit to operator
 *      5. Includes profitability checks (reverts if not profitable)
 */
contract OxGladiusFiller is IGladiusFiller, IReactorCallback {
    using SafeERC20 for IERC20;

    // Events
    event OrderFilled(
        bytes32 indexed orderHash,
        address indexed filler,
        uint256 fillAmount,
        string aggregator
    );
    
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    event ProfitConverted(
        address indexed token,
        uint256 tokenAmount,
        uint256 ethAmount
    );

    event ETHReturned(
        address indexed operator,
        uint256 ethAmount
    );

    // State variables
    address public owner;
    address public gladiusReactor;
    address public allowanceHolder; // 0x AllowanceHolder for arbitrage leg
    address public weth; // WETH address for ETH conversions
    address public uniswapV2Router; // Uniswap V2 Router for on-chain profit conversion
    
    // Temporary context during execution (single slot, execution is non-reentrant)
    address private currentOperator;
    uint256 private initialETH;
    address private profitTokenAddress;

    /// @notice Constructor
    /// @param _gladiusReactor Address of GladiusReactor (use address(0) for Base default)
    /// @param _allowanceHolder Address of 0x AllowanceHolder (use address(0) for Base default)
    /// @param _weth Address of WETH token (required for ETH conversions)
    /// @param _uniswapV2Router Address of Uniswap V2 Router for profit conversion
    constructor(
        address _gladiusReactor, 
        address _allowanceHolder,
        address _weth,
        address _uniswapV2Router
    ) {
        owner = msg.sender;
        
        gladiusReactor = _gladiusReactor == address(0) 
            ? Addresses.BASE_GLADIUS_REACTOR 
            : _gladiusReactor;
            
        allowanceHolder = _allowanceHolder == address(0)
            ? Addresses.BASE_ALLOWANCE_HOLDER
            : _allowanceHolder;
            
        weth = _weth;
        require(weth != address(0), "WETH address required");
        
        uniswapV2Router = _uniswapV2Router == address(0)
            ? Addresses.BASE_UNISWAP_V2_ROUTER
            : _uniswapV2Router;
        require(uniswapV2Router != address(0), "Uniswap Router required");
    }

    /**
     * @notice Update GladiusReactor address (owner only)
     */
    function setGladiusReactor(address _gladiusReactor) external onlyOwner {
        gladiusReactor = _gladiusReactor;
    }

    /**
     * @notice Update AllowanceHolder address (owner only)
     */
    function setAllowanceHolder(address _allowanceHolder) external onlyOwner {
        allowanceHolder = _allowanceHolder;
    }

    /**
     * @notice Set WETH address (owner only)
     */
    function setWETH(address _weth) external onlyOwner {
        require(_weth != address(0), "Invalid WETH address");
        weth = _weth;
    }

    /**
     * @notice Set Uniswap V2 Router address (owner only)
     */
    function setUniswapRouter(address _router) external onlyOwner {
        require(_router != address(0), "Invalid router address");
        uniswapV2Router = _router;
    }

    /**
     * @notice Fill a Gladius order using 0x aggregator arbitrage
     * @param orderHash The hash of the Gladius order
     * @param order The abi-encoded GladiusOrder
     * @param sig The order signature  
     * @param quantity The quantity to fill
     * @param swapData The 0x swap calldata to source tokens needed (for arbitrage leg)
     * @param minETHReturn Minimum ETH profit to return (profitability check - reverts if not met)
     * @param tokenInfo Encoded: abi.encode(inputToken, outputToken, profitToken)
     * @dev Flow:
     *      1. Execute Gladius fill (reactorCallback executes 0x swap to source tokens via swapData)
     *      2. After fill, convert any profit tokens to ETH via on-chain Uniswap (handles variable amounts)
     *      3. Return ETH profit to operator (reverts if < minETHReturn)
     *      Note: Operator only pays gas - all capital comes from arbitrage
     */
    function fillGladiusOrder(
        bytes32 orderHash,
        bytes memory order,
        bytes memory sig,
        uint256 quantity,
        bytes calldata swapData,
        uint256 minETHReturn, // Minimum ETH profit required
        bytes calldata tokenInfo // abi.encode(inputToken, outputToken, profitToken)
    ) external override {
        require(swapData.length > 0, "Invalid swap data");
        require(minETHReturn > 0, "Must specify min ETH return");
        require(gladiusReactor != address(0), "GladiusReactor not set");
        require(uniswapV2Router != address(0), "Uniswap Router not set");
        
        // Store execution context (single slot, execution is non-reentrant)
        currentOperator = msg.sender;
        initialETH = address(this).balance;
        
        // Decode token addresses
        (address inputToken, address outputToken, address profitToken) = abi.decode(tokenInfo, (address, address, address));
        require(inputToken != address(0) && outputToken != address(0), "Invalid token addresses");
        profitTokenAddress = profitToken;
        
        // Call GladiusReactor.executeWithCallback()
        // This will call our reactorCallback() where we execute the 0x swap
        IGladiusReactor(gladiusReactor).executeWithCallback{value: 0}(
            order,
            sig,
            quantity,
            swapData
        );
        
        // After order is filled, convert profit tokens to ETH using on-chain Uniswap
        // This handles variable amounts perfectly - we swap whatever we actually have
        if (profitTokenAddress != address(0) && profitTokenAddress != weth) {
            uint256 profitBalance = IERC20(profitTokenAddress).balanceOf(address(this));
            if (profitBalance > 0) {
                uint256 ethBefore = address(this).balance;
                _convertTokenToETHOnChain(profitTokenAddress, profitBalance);
                emit ProfitConverted(
                    profitTokenAddress, 
                    profitBalance, 
                    address(this).balance - ethBefore
                );
            }
        } else if (profitTokenAddress == weth) {
            // If profit is already WETH, just unwrap
            uint256 wethBal = IERC20(weth).balanceOf(address(this));
            if (wethBal > 0) {
                IWETH(weth).withdraw(wethBal);
                emit ProfitConverted(weth, wethBal, wethBal);
            }
        }
        
        // Calculate and return ETH profit
        uint256 ethProfit = address(this).balance > initialETH ? address(this).balance - initialETH : 0;
        require(ethProfit >= minETHReturn, "Insufficient profit");
        if (ethProfit > 0) {
            (bool ok, ) = currentOperator.call{value: ethProfit}("");
            require(ok, "ETH transfer failed");
            emit ETHReturned(currentOperator, ethProfit);
        }
        
        // Clean up
        delete currentOperator;
        delete initialETH;
        delete profitTokenAddress;
        
        emit OrderFilled(orderHash, msg.sender, quantity, "0x");
    }

    /**
     * @notice Callback function called by GladiusReactor during order execution
     * @param resolvedOrders The resolved orders with calculated input/output amounts
     * @param callbackData Contains the 0x swap calldata to get output tokens
     * @dev Executes the 0x swap to source the tokens needed to fill the order
     */
    function reactorCallback(
        ResolvedOrder[] memory resolvedOrders,
        bytes memory callbackData
    ) external override {
        require(msg.sender == gladiusReactor, "Only reactor can call");
        require(resolvedOrders.length == 1, "Single order expected");
        require(allowanceHolder != address(0), "AllowanceHolder not set");
        
        // ResolvedOrder is the actual struct from gladius-protocol
        // InputToken: { ERC20 token, uint256 amount, uint256 maxAmount }
        // The reactor has already transferred INPUT tokens to this contract (from user via Permit2)
        // We now approve them to AllowanceHolder so 0x swap can pull them
        address inputToken = address(resolvedOrders[0].input.token);
        uint256 inputAmount = resolvedOrders[0].input.amount;
        IERC20(inputToken).safeIncreaseAllowance(allowanceHolder, inputAmount);
        
        // Execute the 0x swap - AllowanceHolder will pull input tokens and send output tokens here
        // callbackData contains the 0x swap transaction calldata
        (bool success, ) = payable(allowanceHolder).call(callbackData);
        require(success, "0x swap failed");
        
        // After swap, output tokens are in this contract
        // We need to approve them to the reactor so it can pull them after this callback returns
        // OutputToken: { address token, uint256 amount, address recipient }
        address outputToken = resolvedOrders[0].outputs[0].token;
        uint256 outputAmount = resolvedOrders[0].outputs[0].amount;
        
        // Approve output tokens to reactor (reactor will only pull what it needs)
        // We approve the exact amount needed - reactor's transferFrom will take this exact amount
        IERC20(outputToken).safeIncreaseAllowance(gladiusReactor, outputAmount);
    }

    /**
     * @notice Convert any ERC20 token to ETH using Uniswap V2 on-chain
     * @param token The token address to convert
     * @param amount The amount to convert (will swap whatever balance we have)
     * @dev Uses Uniswap V2 swapExactTokensForETH - handles variable amounts perfectly
     *      No need for off-chain quotes since we're executing on-chain at execution time
     */
    function _convertTokenToETHOnChain(address token, uint256 amount) private {
        // Create path: token -> WETH
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = weth;
        
        // Approve router to spend tokens
        IERC20(token).safeIncreaseAllowance(uniswapV2Router, amount);
        
        // Swap exact tokens for ETH using on-chain Uniswap
        // Note: amountOutMin = 0 because profitability check (minETHReturn) handles slippage protection
        // If Uniswap gives us less than expected due to slippage, we revert at profitability check
        IUniswapV2Router02(uniswapV2Router).swapExactTokensForETH(
            amount,
            0, // Slippage protection via minETHReturn profitability check
            path,
            address(this),
            block.timestamp
        );
        
        // Unwrap any WETH we received
        uint256 wethBalance = IERC20(weth).balanceOf(address(this));
        if (wethBalance > 0) {
            IWETH(weth).withdraw(wethBalance);
        }
    }


    /**
     * @notice Check if an order has been filled (always false - we don't track history)
     * @dev Kept for interface compliance, but no storage used
     */
    function isOrderFilled(bytes32) external pure override returns (bool) {
        return false; // Don't track - rely on Gladius reactor for duplicate prevention
    }

    /**
     * @notice Get the name/identifier of this filler
     */
    function fillerName() external pure override returns (string memory) {
        return "0x";
    }

    /**
     * @notice Owner-only modifier
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    /**
     * @notice Receive ETH
     */
    receive() external payable {}
}

/**
 * @notice Minimal WETH interface for unwrapping
 */
interface IWETH {
    function withdraw(uint256) external;
    function deposit() external payable;
}

/**
 * @notice Minimal Uniswap V2 Router interface
 */
interface IUniswapV2Router02 {
    function swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    function WETH() external pure returns (address);
}
