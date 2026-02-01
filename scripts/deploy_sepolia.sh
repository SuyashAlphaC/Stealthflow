#!/bin/bash
# StealthFlow Sepolia Deployment Script
# Usage: ./deploy_sepolia.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         StealthFlow Sepolia Deployment Script            ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"

# --- Configuration ---
NETWORK="sepolia"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Pragma Oracle on Sepolia (official address)
PRAGMA_ORACLE="0x36031daa264c24520b11d93af622c848b2499b66b41d611bac95e13cfca131a"

# Output file for deployed addresses
DEPLOYMENT_FILE="$SCRIPT_DIR/deployment_sepolia.json"

echo -e "\n${YELLOW}[1/5] Building contracts...${NC}"
cd "$PROJECT_DIR"
scarb build

echo -e "\n${GREEN}✓ Build complete${NC}"

# Check if sncast is available
if ! command -v sncast &> /dev/null; then
    echo -e "${RED}Error: sncast not found. Install Starknet Foundry:${NC}"
    echo "curl -L https://raw.githubusercontent.com/foundry-rs/starknet-foundry/master/scripts/install.sh | sh"
    exit 1
fi

# Check for account setup
if [ -z "$STARKNET_ACCOUNT" ]; then
    echo -e "${YELLOW}⚠ STARKNET_ACCOUNT not set. Using default account...${NC}"
    echo -e "${YELLOW}  Run: sncast account create --name sepolia-deployer --network sepolia${NC}"
fi

echo -e "\n${YELLOW}[2/5] Declaring StealthAnnouncer...${NC}"
ANNOUNCER_DECLARE=$(sncast --network $NETWORK declare \
    --contract-name StealthAnnouncer 2>&1) || true

ANNOUNCER_CLASS_HASH=$(echo "$ANNOUNCER_DECLARE" | grep -oP 'class_hash: \K0x[a-fA-F0-9]+' || echo "")
if [ -z "$ANNOUNCER_CLASS_HASH" ]; then
    echo -e "${YELLOW}Already declared or extracting from cache...${NC}"
    ANNOUNCER_CLASS_HASH=$(sncast --network $NETWORK declare \
        --contract-name StealthAnnouncer 2>&1 | grep -oP '0x[a-fA-F0-9]+' | head -1)
fi
echo -e "${GREEN}✓ StealthAnnouncer class_hash: $ANNOUNCER_CLASS_HASH${NC}"

echo -e "\n${YELLOW}[3/5] Deploying StealthAnnouncer...${NC}"
ANNOUNCER_DEPLOY=$(sncast --network $NETWORK deploy \
    --class-hash "$ANNOUNCER_CLASS_HASH" 2>&1)

ANNOUNCER_ADDRESS=$(echo "$ANNOUNCER_DEPLOY" | grep -oP 'contract_address: \K0x[a-fA-F0-9]+' || echo "")
echo -e "${GREEN}✓ StealthAnnouncer deployed: $ANNOUNCER_ADDRESS${NC}"

echo -e "\n${YELLOW}[4/5] Declaring StealthPaymaster...${NC}"
PAYMASTER_DECLARE=$(sncast --network $NETWORK declare \
    --contract-name StealthPaymaster 2>&1) || true

PAYMASTER_CLASS_HASH=$(echo "$PAYMASTER_DECLARE" | grep -oP 'class_hash: \K0x[a-fA-F0-9]+' || echo "")
if [ -z "$PAYMASTER_CLASS_HASH" ]; then
    PAYMASTER_CLASS_HASH=$(sncast --network $NETWORK declare \
        --contract-name StealthPaymaster 2>&1 | grep -oP '0x[a-fA-F0-9]+' | head -1)
fi
echo -e "${GREEN}✓ StealthPaymaster class_hash: $PAYMASTER_CLASS_HASH${NC}"

echo -e "\n${YELLOW}[5/5] Declaring StealthAccount...${NC}"
ACCOUNT_DECLARE=$(sncast --network $NETWORK declare \
    --contract-name StealthAccount 2>&1) || true

ACCOUNT_CLASS_HASH=$(echo "$ACCOUNT_DECLARE" | grep -oP 'class_hash: \K0x[a-fA-F0-9]+' || echo "")
if [ -z "$ACCOUNT_CLASS_HASH" ]; then
    ACCOUNT_CLASS_HASH=$(sncast --network $NETWORK declare \
        --contract-name StealthAccount 2>&1 | grep -oP '0x[a-fA-F0-9]+' | head -1)
fi
echo -e "${GREEN}✓ StealthAccount class_hash: $ACCOUNT_CLASS_HASH${NC}"

# Save deployment info
cat > "$DEPLOYMENT_FILE" << EOF
{
  "network": "$NETWORK",
  "timestamp": "$(date -Iseconds)",
  "contracts": {
    "StealthAnnouncer": {
      "class_hash": "$ANNOUNCER_CLASS_HASH",
      "address": "$ANNOUNCER_ADDRESS"
    },
    "StealthPaymaster": {
      "class_hash": "$PAYMASTER_CLASS_HASH",
      "address": "NOT_DEPLOYED"
    },
    "StealthAccount": {
      "class_hash": "$ACCOUNT_CLASS_HASH",
      "address": "COUNTERFACTUAL"
    }
  },
  "config": {
    "pragma_oracle": "$PRAGMA_ORACLE"
  }
}
EOF

echo -e "\n${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                  Deployment Summary                       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo -e "${GREEN}StealthAnnouncer:${NC} $ANNOUNCER_ADDRESS"
echo -e "${GREEN}StealthPaymaster (class):${NC} $PAYMASTER_CLASS_HASH"
echo -e "${GREEN}StealthAccount (class):${NC} $ACCOUNT_CLASS_HASH"
echo -e "\n${YELLOW}Deployment saved to: $DEPLOYMENT_FILE${NC}"

echo -e "\n${CYAN}Next Steps:${NC}"
echo "1. Deploy StealthPaymaster with constructor args:"
echo "   sncast --network sepolia deploy --class-hash $PAYMASTER_CLASS_HASH \\"
echo "     --constructor-calldata <OWNER> $PRAGMA_ORACLE 1 <TOKEN_ADDR> 1 <PAIR_ID>"
echo ""
echo "2. Update frontend .env.local:"
echo "   NEXT_PUBLIC_ANNOUNCER_ADDRESS=$ANNOUNCER_ADDRESS"
echo "   NEXT_PUBLIC_ACCOUNT_CLASS_HASH=$ACCOUNT_CLASS_HASH"
echo ""
echo "3. Run the SDK to generate stealth addresses:"
echo "   python3 scripts/stealth_sdk.py"
