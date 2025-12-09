# Solidity Contracts

ERC-1056 compliant Ethereum DID Registry for decentralized identity management.

## Overview

This package implements the **ERC-1056** (Ethereum DID Registry) standard, providing a lightweight and cost-effective way to manage decentralized identities on Ethereum.

### Key Features

- ✅ **Free identity creation**: Any Ethereum address is a valid identity
- ✅ **Owner management**: Transfer ownership to new keys or multisig contracts
- ✅ **Delegates**: Temporary authorization for specific operations with expiry
- ✅ **Attributes**: Flexible key-value storage for DID documents
- ✅ **Meta-transactions**: Off-chain signing support (EIP-191)
- ✅ **Event-based**: All changes emit events for off-chain indexing

## Structure

```
solidity/
├── src/
│   └── EthereumDIDRegistry.sol    # ERC-1056 implementation
├── test/
│   └── EthereumDIDRegistry.t.sol  # Comprehensive test suite (24 tests)
├── script/
│   └── DeployDIDRegistry.s.sol    # Deployment script
├── foundry.toml                    # Foundry configuration
├── soldeer.lock                    # Soldeer lock file
└── remappings.txt                  # Import remappings
```

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)

## Installation

```bash
# Install dependencies via Soldeer
forge soldeer update
```

## Development

### Build

```bash
forge build
```

### Test

```bash
# Run all tests
forge test

# Run tests with gas reporting
forge test --gas-report

# Run tests with verbosity
forge test -vvv

# Run specific test
forge test --match-test test_ChangeOwner
```

### Format

```bash
forge fmt
```

### Coverage

```bash
forge coverage
```

## Usage Examples

### Identity Ownership

```solidity
// By default, an identity owns itself
address owner = registry.identityOwner(myAddress); // returns myAddress

// Transfer ownership to a new address
registry.changeOwner(myAddress, newOwner);

// Transfer ownership using a signed message (meta-transaction)
registry.changeOwnerSigned(identity, v, r, s, newOwner);
```

### Delegates

```solidity
// Add a delegate for 30 days
registry.addDelegate(
    myAddress,
    "sigAuth",      // delegate type
    delegateAddr,
    30 days         // validity period
);

// Check if delegate is valid
bool isValid = registry.validDelegate(myAddress, "sigAuth", delegateAddr);

// Revoke a delegate
registry.revokeDelegate(myAddress, "sigAuth", delegateAddr);
```

### Attributes

```solidity
// Set an attribute (e.g., public key)
registry.setAttribute(
    myAddress,
    "did/pub/Ed25519/veriKey/base64",
    "0x1234...",
    365 days
);

// Revoke an attribute
registry.revokeAttribute(
    myAddress,
    "did/pub/Ed25519/veriKey/base64",
    "0x1234..."
);
```

## Gas Costs

Average gas costs for common operations:

| Operation              | Gas Cost |
| ---------------------- | -------- |
| `changeOwner`          | ~68,800  |
| `addDelegate`          | ~71,700  |
| `revokeDelegate`       | ~29,900  |
| `setAttribute`         | ~50,500  |
| `revokeAttribute`      | ~31,000  |
| `identityOwner` (view) | ~2,645   |
| `validDelegate` (view) | ~2,992   |

## Adding Dependencies

Use Soldeer to manage dependencies:

```bash
# Install a dependency
forge soldeer install <package>~<version>

# Example: Install OpenZeppelin contracts
forge soldeer install @openzeppelin-contracts~5.1.0
```

## Deployment

Deployment scripts are located in the `script/` directory.

```bash
# Deploy to local network (Anvil)
forge script script/DeployDIDRegistry.s.sol --rpc-url $ANVIL_RPC_URL --broadcast

# Deploy to testnet with verification
forge script script/DeployDIDRegistry.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

## ERC-1056 Standard

This implementation follows the [ERC-1056](https://eips.ethereum.org/EIPS/eip-1056) specification for Ethereum DID Registry.

### Events

All state changes emit events for off-chain indexing:

- `DIDOwnerChanged(address indexed identity, address owner, uint256 previousChange)`
- `DIDDelegateChanged(address indexed identity, bytes32 delegateType, address delegate, uint256 validTo, uint256 previousChange)`
- `DIDAttributeChanged(address indexed identity, bytes32 name, bytes value, uint256 validTo, uint256 previousChange)`

### Integration with DID Documents

The registry is designed to work with DID resolvers that listen to events and construct DID documents. Example DID format:

```
did:ethr:0x1234567890123456789012345678901234567890
```

## Testing

The test suite includes:

- ✅ 24 unit tests covering all functionality
- ✅ Integration tests for complete workflows
- ✅ Fuzz tests for edge cases
- ✅ Signature verification tests
- ✅ Access control tests

All tests pass with 100% success rate.

## Security Considerations

- All signed functions use EIP-191 signature verification
- Nonce-based replay protection for meta-transactions
- Owner-only access control for identity management
- Delegate expiry enforced on-chain

## License

MIT
