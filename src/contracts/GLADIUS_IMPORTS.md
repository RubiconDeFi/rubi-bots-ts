# Gladius Contracts Integration Guide

## ✅ Repository Located

**Gladius Protocol Repo**: [RubiconDeFi/gladius-protocol](https://github.com/RubiconDeFi/gladius-protocol)

**Status**: Dependency installed via GitHub ✅

## 📁 Key Contracts Location

The contracts are in `node_modules/gladius-protocol/src/`:

### Critical Files for Filler:

1. **`src/lib/PartialFillLib.sol`**
   - Contains `GladiusOrder` struct
   - Partial fill logic (`partition` function)
   - **This is the main struct we need!**

2. **`src/base/ReactorStructs.sol`**
   - `OrderInfo`, `SignedOrder`, `ResolvedOrder`
   - `InputToken`, `OutputToken`
   - `DutchInput`, `DutchOutput`

3. **`src/reactors/GladiusReactor.sol`**
   - Main contract for filling orders
   - Has `execute()` and `executeBatch()` functions
   - Resolves `GladiusOrder` → `ResolvedOrder`

4. **`src/reactors/BaseGladiusReactor.sol`**
   - Base implementation with execute entry points
   - Handles order execution flow

## ⚠️ Import Challenge

The Gladius repo uses **Foundry** with remappings and submodules (solmate, etc.). Hardhat struggles to compile these directly.

## 🎯 Recommended Approach: Copy Minimal Interfaces

**Best solution**: Copy only the structs/interfaces we need into `contracts/interfaces/gladius/`

**Why:**
- ✅ Avoids Foundry dependency conflicts
- ✅ Full control over what we import
- ✅ Faster compilation
- ✅ Easy to update when Gladius changes

**What to copy:**
1. `GladiusOrder` struct (from PartialFillLib.sol)
2. Core structs (OrderInfo, DutchInput, DutchOutput, etc.)
3. Any validation logic we need

## 📝 Next Steps

Share with me:
1. **Which specific interfaces/structs you want** OR
2. **Let me create minimal copies** based on what our filler needs

The filler needs:
- ✅ `GladiusOrder` struct (order structure)
- ✅ `OrderInfo` struct (order metadata)
- ✅ `DutchInput` / `DutchOutput` structs (token amounts with decay)
- ✅ Validation functions (if any needed)

I'll create clean, minimal interfaces in `contracts/interfaces/gladius/` that we can import!

## Alternative: Try Hardhat Remappings

If you want to use the full repo, we could:
1. Install submodule dependencies
2. Configure Hardhat remappings
3. Use full imports

But **copying interfaces is cleaner** for our use case! 🎯

