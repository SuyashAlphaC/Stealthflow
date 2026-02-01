# StealthFlow Sepolia Testing Guide

## Prerequisites

```bash
# 1. Install Starknet Foundry
curl -L https://raw.githubusercontent.com/foundry-rs/starknet-foundry/master/scripts/install.sh | sh
snfoundryup

# 2. Install Python dependencies
pip install starknet-py garaga pycryptodome
```

## Step 1: Create & Fund Account

```bash
# Create deployer account
sncast account create --name sepolia-deployer --network sepolia

# Fund from faucet: https://faucet.starknet.io
# Then deploy account
sncast account deploy --name sepolia-deployer --network sepolia --fee-token strk
```

## Step 2: Deploy Contracts

```bash
cd /home/suyashagrawal/Documents/StealthFlow
./scripts/deploy_sepolia.sh
```

This will:
- Build all contracts
- Declare StealthAnnouncer, StealthPaymaster, StealthAccount
- Deploy StealthAnnouncer
- Save addresses to `scripts/deployment_sepolia.json`

## Step 3: Deploy StealthPaymaster (with constructor)

```bash
# Get your owner address and STRK token address
OWNER="0x..." # Your deployer address
STRK_TOKEN="0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d" # STRK on Sepolia

sncast --network sepolia deploy \
  --class-hash <PAYMASTER_CLASS_HASH> \
  --constructor-calldata $OWNER 0x36031daa264c24520b11d93af622c848b2499b66b41d611bac95e13cfca131a 1 $STRK_TOKEN 1 0x5354524b2f555344
```

## Step 4: Test SDK

```bash
# Run stealth address demo
python3 scripts/stealth_sdk.py

# Generate test vectors
python3 scripts/stealth_sdk.py --test-vector
```

## Step 5: Frontend Configuration

Create `frontend/.env.local`:
```
NEXT_PUBLIC_STARKNET_NETWORK=sepolia
NEXT_PUBLIC_ANNOUNCER_ADDRESS=0x...
NEXT_PUBLIC_PAYMASTER_ADDRESS=0x...
NEXT_PUBLIC_ACCOUNT_CLASS_HASH=0x...
```

## Step 6: Test Full Flow

1. **Connect wallet** in frontend (Argent X or Braavos on Sepolia)
2. **Generate stealth address** for recipient
3. **Send funds** to stealth address
4. **Announce** payment via StealthAnnouncer
5. Recipient **scans** announcements
6. Recipient **deploys** StealthAccount counterfactually
7. Recipient **claims** with Garaga signature

## Key Addresses

| Contract | Sepolia Address |
|----------|-----------------|
| Pragma Oracle | `0x36031daa264c24520b11d93af622c848b2499b66b41d611bac95e13cfca131a` |
| STRK Token | `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d` |
| ETH Token | `0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7` |

## Verification Commands

```bash
# Check contract state
sncast --network sepolia call \
  --contract-address <ANNOUNCER_ADDRESS> \
  --function "get_announcement_count"

# View events
starkli events <ANNOUNCER_ADDRESS> --network sepolia
```
