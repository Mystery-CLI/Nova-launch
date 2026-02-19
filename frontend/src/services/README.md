# Stellar Service Implementation

## Overview

This service provides methods to interact with the Stellar blockchain, including querying token information and monitoring transaction status.

## Features

### 1. `getTokenInfo(tokenAddress: string): Promise<TokenInfo>`

Retrieves comprehensive information about a deployed token.

**Parameters:**
- `tokenAddress`: Stellar contract address (C-address)

**Returns:**
- `TokenInfo` object containing:
  - `address`: Token contract address
  - `name`: Token name
  - `symbol`: Token symbol
  - `decimals`: Number of decimals
  - `totalSupply`: Total token supply
  - `creator`: Address that deployed the token
  - `metadataUri`: Optional IPFS metadata URI
  - `deployedAt`: Deployment timestamp
  - `transactionHash`: Deployment transaction hash

**Error Handling:**
- Throws `Error('Invalid token address')` for malformed addresses
- Gracefully handles missing metadata (returns `undefined`)
- Falls back to default values if contract calls fail

**Example:**
```typescript
const service = new StellarService('testnet');
const tokenInfo = await service.getTokenInfo('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC');
console.log(tokenInfo.name, tokenInfo.symbol);
```

### 2. `monitorTransaction(hash: string, onProgress?: (status: TransactionDetails) => void): Promise<TransactionDetails>`

Monitors a transaction until it's confirmed or times out.

**Parameters:**
- `hash`: Transaction hash to monitor
- `onProgress`: Optional callback for status updates

**Returns:**
- `TransactionDetails` object containing:
  - `hash`: Transaction hash
  - `status`: 'pending' | 'success' | 'failed'
  - `timestamp`: Transaction timestamp
  - `fee`: Transaction fee

**Behavior:**
- Polls Horizon API every 2 seconds initially
- Implements exponential backoff (up to 10 seconds)
- Timeouts after 60 seconds
- Calls `onProgress` callback on each status change

**Error Handling:**
- Throws `Error('Transaction monitoring timeout')` after 60 seconds
- Retries on network errors with exponential backoff

**Example:**
```typescript
const service = new StellarService('testnet');

const result = await service.monitorTransaction(
  'abc123...',
  (status) => {
    console.log(`Status: ${status.status}`);
  }
);

console.log(`Final status: ${result.status}`);
```

## Implementation Details

### Polling Strategy

- **Initial interval**: 2000ms
- **Max interval**: 10000ms
- **Backoff multiplier**: 1.5x
- **Timeout**: 60000ms

### Network Configuration

**Testnet:**
- RPC: `https://soroban-testnet.stellar.org`
- Horizon: `https://horizon-testnet.stellar.org`

**Mainnet:**
- RPC: `https://soroban-mainnet.stellar.org`
- Horizon: `https://horizon.stellar.org`

## Testing

Run tests with:
```bash
npm test -- stellar.test.ts
```

Tests cover:
- Invalid address validation
- Token info retrieval with/without metadata
- Transaction monitoring success/failure
- Polling behavior
- Timeout handling

## Dependencies

- `@stellar/stellar-sdk`: Stellar blockchain SDK
- Native `fetch`: HTTP requests to Horizon API

## Usage in Application

```typescript
import { StellarService } from './services/stellar';

// Initialize service
const stellar = new StellarService('testnet');

// Query token info
const tokenInfo = await stellar.getTokenInfo(tokenAddress);

// Monitor transaction
const txResult = await stellar.monitorTransaction(
  txHash,
  (progress) => {
    // Update UI with progress
    setStatus(progress.status);
  }
);
```

## Future Enhancements

- [ ] Batch token info queries
- [ ] WebSocket support for real-time updates
- [ ] Caching layer for token info
- [ ] Retry configuration options
- [ ] Custom timeout values
