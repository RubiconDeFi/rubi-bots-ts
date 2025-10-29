# Gladius Execution Flow

## 🎯 Key Understanding

**Gladius = Reactor + OrderQuoter**

### Components:
1. **GladiusReactor** - On-chain contract that executes orders
2. **GladiusOrderQuoter** - Off-chain lens to validate/quote orders
3. **GladiusOrder** - Order struct (Dutch auction with partial fills)

## 📋 Execution Flow

### Step-by-Step Flow for Filler:

```
1. Filler calls: GladiusReactor.executeWithCallback(order, quantity, swapData)
   ↓
2. Reactor resolves order:
   - Decodes GladiusOrder from SignedOrder
   - Applies decay (Dutch auction price at current time)
   - Applies partition (partial fill if quantity < full amount)
   ↓
3. Reactor prepares (_prepare):
   - Validates order
   - Injects fees
   - Transfers INPUT tokens FROM swapper TO reactor (via Permit2)
   ↓
4. Reactor calls: IReactorCallback.reactorCallback(resolvedOrders, swapData)
   ↓
5. Filler (our contract) in reactorCallback:
   - Executes 0x swap using swapData
   - Receives OUTPUT tokens
   - Must approve OUTPUT tokens to reactor
   ↓
6. Reactor fills (_fill):
   - Pulls OUTPUT tokens from filler via transferFrom
   - Transfers OUTPUT tokens to swapper (recipient)
   - Emits Fill event
```

## 🔑 Key Structs

### GladiusOrder
```solidity
struct GladiusOrder {
    OrderInfo info;              // Reactor, swapper, nonce, deadline, validation
    uint256 decayStartTime;      // Dutch auction decay start
    uint256 decayEndTime;        // Dutch auction decay end
    address exclusiveFiller;     // Exclusive filler until decayStartTime
    uint256 exclusivityOverrideBps;  // Override threshold in bps
    DutchInput input;            // Input token (with decay amounts)
    DutchOutput[] outputs;       // Output tokens (with decay amounts)
    uint256 fillThreshold;       // Minimum partial fill amount
}
```

### ResolvedOrder (after resolution)
```solidity
struct ResolvedOrder {
    OrderInfo info;
    InputToken input;            // Actual input amount (after decay)
    OutputToken[] outputs;       // Actual output amounts (after decay)
    bytes sig;                   // Signature
    bytes32 hash;                // Order hash
}
```

## 🛠️ What Our Filler Needs

### 1. Interface Implementation
- `IReactorCallback.reactorCallback()` - Called during execution

### 2. Execution Function
- Call `GladiusReactor.executeWithCallback(order, quantity, swapData)`

### 3. Swap Execution
- In callback, execute 0x swap to get output tokens
- Approve output tokens to reactor

### 4. Token Handling
- Input tokens: Already in reactor (transferred via Permit2)
- Output tokens: We need to provide them (via 0x swap)

## 📝 Order Quoter Usage

Use `GladiusOrderQuoter.quote()` off-chain to:
- Validate orders
- Get current resolved amounts (with decay applied)
- Check if order is fillable

## ✅ Ready for 0x Integration!

Now we understand:
- ✅ How orders are structured
- ✅ How execution works
- ✅ What our contract needs to do
- ✅ Where 0x swap fits in (reactorCallback)

**Next: Get 0x API details and wire it up!** 🚀

