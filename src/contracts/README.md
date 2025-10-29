# Rubi Bots Smart Contracts 🚀

Smart contract workspace for **rubi-bots-ts**. A robust area for any smart contracts relevant to the Rubicon bots ecosystem.

## Current Focus: Modular Gladius Fillers

Today we're starting with **0xGladiusFiller** - a modular filler for Gladius Dutch auction orders using the 0x aggregator. This architecture allows us to create a future meta contract that aggregates multiple fillers (0x, ODOS, etc.) into one master contract.

## Quick Start

```bash
# Navigate to contracts folder
cd src/contracts

# Compile, test, and deploy
yarn compile  # Compile contracts
yarn test     # Run tests
yarn node     # Start local Hardhat node
yarn deploy   # Deploy to network
```

## What's Here

### 📂 General Structure

This workspace is set up for multiple contracts and features:
- ✅ Hardhat configuration with multiple network support
- ✅ Comprehensive testing framework
- ✅ Deployment scripts
- ✅ Type generation and intellisense

### 📄 Current Contracts

#### `0xGladiusFiller.sol`
The 0x-specific filler for Gladius orders.

**Current Features:**
- ✅ Implements `IGladiusFiller` and `IReactorCallback` interfaces
- ✅ Integrates with GladiusReactor for order execution
- ✅ Executes 0x swaps via AllowanceHolder (following SimpleTokenSwap pattern)
- ✅ Order tracking (prevents double-filling)
- ✅ Event emission with aggregator identification
- ✅ Owner access control with configurable addresses
- ✅ Filler name identification ("0x")
- ✅ Default addresses for Base network
- ✅ Chain-specific address configuration
- ⏳ TODO: Complete token approval handling in callback
- ⏳ TODO: Full testing with real Gladius orders

#### `IGladiusFiller.sol`
Interface for all modular fillers. Future fillers (ODOSGladiusFiller, etc.) will implement this.

### 🧪 Tests: `0xGladiusFiller.test.ts`

All 7 tests passing! ✅
- Owner verification
- Order filling
- Double-fill prevention
- Empty swap data validation
- Interface compliance
- Filler name verification

### 🔧 Configuration

- **Solidity**: 0.8.20 with optimizer (200 runs)
- **Networks**: Hardhat (local), Base, Base Sepolia
- **Testing**: Hardhat + Chai + Ethers v6

## 0xGladiusFiller Status

✅ **Completed:**
1. ✅ Gladius Contracts Integration - References installed in `node_modules/gladius-protocol`
2. ✅ 0x API Integration - TypeScript helper (`ZeroXFiller`) created
3. ✅ Contract Implementation - Swap execution via AllowanceHolder
4. ✅ Address Configuration - Constants for all supported chains
5. ✅ Interface Design - Modular architecture ready for ODOSGladiusFiller

⏳ **Remaining:**
1. **Token Approval Logic** - Complete output token approval in `reactorCallback()`
2. **Testing** - Full test suite with mocked Gladius orders
3. **Bot Integration** - Connect TypeScript bot to contract for monitoring/filling
4. **Gas Optimization** - Batch operations, storage packing
5. **Production Deployment** - Deploy to Base/other networks

See `CONFIG.md` for deployment addresses and environment setup.

## Future Contracts

### Modular Fillers
- `ODOSGladiusFiller.sol` - ODOS aggregator filler (implements IGladiusFiller)
- `MetaGladiusFiller.sol` - Master contract that aggregates 0x, ODOS, etc. fillers

### Other Contracts
- Order routing contracts
- Fee management contracts
- Multi-hop strategy contracts
- And more...

## File Structure

```
src/contracts/
├── contracts/
│   ├── interfaces/
│   │   └── IGladiusFiller.sol  # Interface for modular fillers
│   └── 0xGladiusFiller.sol     # 0x-specific filler (implements IGladiusFiller)
├── test/
│   └── 0xGladiusFiller.test.ts # Test suite
├── scripts/
│   └── deploy.ts               # Deployment script
├── hardhat.config.ts           # Hardhat config
└── package.json                # Dependencies
```

## Development Workflow

```bash
# 1. Compile
yarn contracts:compile

# 2. Test (with auto-compile)
yarn contracts:test

# 3. Deploy to local node
yarn contracts:node     # Terminal 1: Start node
yarn contracts:deploy   # Terminal 2: Deploy

# 4. Deploy to testnet/mainnet
yarn contracts:deploy --network baseSepolia
```

## Contract Interface

### IGladiusFiller (Interface)

```solidity
function fillGladiusOrder(
    bytes32 orderHash,
    uint256 fillAmount,
    bytes calldata swapData
) external;

function isOrderFilled(bytes32 orderHash) external view returns (bool);

function fillerName() external pure returns (string memory);
```

### 0xGladiusFiller (Implementation)

Implements `IGladiusFiller` for 0x aggregator swaps.

## Environment Variables

Create `.env` in `src/contracts/`:
```
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=your_private_key_here
```

## Notes

- Uses Hardhat Toolbox (all-in-one dev environment)
- Ethers v6 syntax in tests
- Type-safe contract interfaces auto-generated
- Gas reporting available via `hardhat-gas-reporter`

Ready to speedrun! 🏃‍♂️💨