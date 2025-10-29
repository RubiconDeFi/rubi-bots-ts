# 0xGladiusFiller Configuration

## Environment Variables

Add to root `.env` file:

```env
# 0x API Key (get from https://dashboard.0x.org/)
ZEROX_API_KEY=your_api_key_here
```

## Contract Addresses

### Base Network (Chain ID: 8453)

- **GladiusReactor**: `0x3C53c04d633bec3fB0De3492607C239BF92d07f9`
- **GladiusOrderQuoter**: `0x56e43695d183dcFa9D8fE95E796227A491627Fd9`
- **RubiconFeeController**: `0x72826Cd3c3040e00F2D831d835b1554Ec02ef58a`
- **0x AllowanceHolder**: `0x0000000000001fF3684f28c67538d4D072C22734`

### Optimism (Chain ID: 10)

- **GladiusReactor**: `0x98169248bDf25E0e297EA478Ab46ac24058Fac78`
- **GladiusOrderQuoter**: `0x9244aeAE36f34d63244EDCF9fdb58C03cE4Ce12d`
- **RubiconFeeController**: `0xD376b6BAb4c5dA3Cd83DD49A346b3D432385724E`
- **0x AllowanceHolder**: `0x0000000000001fF3684f28c67538d4D072C22734`

### Arbitrum (Chain ID: 42161)

- **GladiusReactor**: `0x6D81571B4c75CCf08bD16032D0aE54dbaff548b0`
- **GladiusOrderQuoter**: `0x9244aeAE36f34d63244EDCF9fdb58C03cE4Ce12d`
- **RubiconFeeController**: `0xB6efa81466ab4A93129245bD2aAA535280F7ADbB`
- **0x AllowanceHolder**: `0x0000000000001fF3684f28c67538d4D072C22734`

## Deployment

### Constructor Parameters

The `OxGladiusFiller` contract can be deployed with default addresses for Base:

```solidity
// Base deployment (uses default addresses)
new OxGladiusFiller(address(0), address(0))

// Custom deployment
new OxGladiusFiller(gladiusReactor, allowanceHolder)
```

If you pass `address(0)`, it will use the Base defaults from `Addresses.sol`.

## Usage in TypeScript

```typescript
import { ZeroXFiller } from '../fillers/0xFiller';
import { ethers } from 'ethers';

const provider = new ethers.providers.JsonRpcProvider('YOUR_RPC_URL');
const chainId = 8453; // Base
const apiKey = process.env.ZEROX_API_KEY!;

const zeroXFiller = new ZeroXFiller(chainId, provider, apiKey, userAddress);

// Get a quote
const quote = await zeroXFiller.getQuote(
    sellTokenAddress,
    buyTokenAddress,
    sellAmount
);

// Use quote.to, quote.data, quote.value for swap execution
```

