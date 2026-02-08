#!/usr/bin/env python3

"""
StealthFlow Gasless Claim Script - Manual Execution
=====================================================

This script allows recipients to claim their funds from a stealth address.
The sponsor pays gas fees for deployment and transfer in a single atomic transaction.

USAGE:
    python3 gasless_claim.py --stealth-priv <PRIVATE_KEY> --to <RECIPIENT_ADDRESS> [--amount <AMOUNT_WEI>]

REQUIRED ENVIRONMENT VARIABLES:
    SPONSOR_ADDRESS      - Address of the sponsor account
    SPONSOR_PRIVATE_KEY  - Private key of the sponsor account
    STARKNET_RPC_URL     - (Optional) Custom RPC URL, defaults to Alchemy Sepolia

EXAMPLES:
    # Sweep all funds from stealth address to recipient:
    python3 gasless_claim.py --stealth-priv 0x1234...abcd --to 0xrecipient...

    # Transfer specific amount (in wei):
    python3 gasless_claim.py --stealth-priv 0x1234...abcd --to 0xrecipient... --amount 1000000000000000000

NOTES:
    - The stealth private key is provided by the sender when they send you funds
    - The recipient address should be your wallet address where you want to receive funds
    - Amount is in wei (1 STRK = 1e18 wei). Use 0 or omit to sweep all available funds.
"""

import os
import sys
import asyncio
import argparse
import dataclasses
import random

# Load .env file if present (for easier local configuration)
try:
    from dotenv import load_dotenv
    load_dotenv()  # Load from .env in current directory or parent directories
except ImportError:
    pass  # python-dotenv not installed, use shell environment only

from starknet_py.net.full_node_client import FullNodeClient
from starknet_py.net.account.account import Account
from starknet_py.net.models import StarknetChainId
from starknet_py.net.signer.stark_curve_signer import KeyPair, StarkCurveSigner
from starknet_py.hash.address import compute_address
from starknet_py.net.client_models import Call, ResourceBounds, ResourceBoundsMapping
from starknet_py.hash.selector import get_selector_from_name
from poseidon_py.poseidon_hash import poseidon_hash_many

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

RPC_URL = os.environ.get("STARKNET_RPC_URL", "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/LfKXerIDAvp3ToDzzjfD8")
STEALTH_ACCOUNT_CLASS_HASH = 0x03487cf5ae2106db423e02de50b934643c63d893f816966009c7270fb159256a
STRK_TOKEN = 0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
UDC_ADDRESS = 0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf
GAS_REIMBURSEMENT = 10_000_000_000_000_000 # 0.01 STRK

# Default Sponsor (can be overridden via environment variables)
DEFAULT_SPONSOR_ADDRESS = "0x0"
DEFAULT_SPONSOR_PRIVATE_KEY = "0x0"

SPONSOR_ADDRESS = int(os.environ.get("SPONSOR_ADDRESS", DEFAULT_SPONSOR_ADDRESS), 16)
SPONSOR_PRIVATE_KEY = int(os.environ.get("SPONSOR_PRIVATE_KEY", DEFAULT_SPONSOR_PRIVATE_KEY), 16)

# ═══════════════════════════════════════════════════════════════════════════════
# SECP256K1 UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
G_X = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
G_Y = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8

def modinv(a, m):
    if a < 0: a = a % m
    g, x, _ = extended_gcd(a, m)
    if g != 1: raise Exception('Modular inverse does not exist')
    return x % m

def extended_gcd(a, b):
    if a == 0: return b, 0, 1
    gcd, x1, y1 = extended_gcd(b % a, a)
    return gcd, y1 - (b // a) * x1, x1

def point_add(p1, p2):
    if p1 is None: return p2
    if p2 is None: return p1
    x1, y1 = p1
    x2, y2 = p2
    if x1 == x2:
        if y1 == y2:
            lam = (3 * x1 * x1) * modinv(2 * y1, P) % P
        else: return None
    else:
        lam = (y2 - y1) * modinv(x2 - x1, P) % P
    x3 = (lam * lam - x1 - x2) % P
    y3 = (lam * (x1 - x3) - y1) % P
    return (x3, y3)

def point_mul(k, point):
    result = None
    addend = point
    while k:
        if k & 1: result = point_add(result, addend)
        addend = point_add(addend, addend)
        k >>= 1
    return result

def derive_public_key(priv_key: int) -> tuple:
    return point_mul(priv_key, (G_X, G_Y))

# ═══════════════════════════════════════════════════════════════════════════════
# GARAGA SIGNATURE GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def get_garaga_signature_calldata(msg_hash: int, priv_key: int) -> list:
    """Generate Garaga signature hints"""
    from garaga.starknet.tests_and_calldata_generators.signatures import ECDSASignature, CurveID
    
    k = random.randrange(1, N)
    kinv = pow(k, N - 2, N)
    R = point_mul(k, (G_X, G_Y))
    r = R[0] % N
    s = (kinv * (msg_hash + r * priv_key)) % N
    v = R[1] % 2
    
    if s > N // 2:
        s = N - s
        v = 1 - v
    
    pub = derive_public_key(priv_key)
    sig = ECDSASignature(r, s, v, pub[0], pub[1], msg_hash, CurveID.SECP256K1)
    
    # We serialize manually or use serialize_with_hints. 
    # Cairo expects: rx(4), s(2), v(1), z(2), hints...
    # z is at offset 7-8.
    serialized = list(sig.serialize_with_hints())
    
    # Python serializes as: rx(0-3), s(4-5), v(6), px(7-10), py(11-14), z(15-16), hints(17+)...
    # Cairo ECDSASignature struct expects: rx, s, v, z
    # So we remove px(7-10) and py(11-14) which are indices 7 to 14
    cleaned_serialized = serialized[:7] + serialized[15:]
    
    return cleaned_serialized

# ═══════════════════════════════════════════════════════════════════════════════
# STEALTH ADDRESS COMPUTATION
# ═══════════════════════════════════════════════════════════════════════════════

def compute_stealth_address(stealth_pub: tuple) -> str:
    x_low = stealth_pub[0] & ((1 << 128) - 1)
    x_high = stealth_pub[0] >> 128
    y_low = stealth_pub[1] & ((1 << 128) - 1)
    y_high = stealth_pub[1] >> 128
    calldata = [x_low, x_high, y_low, y_high]
    
    salt = stealth_pub[0] % (2**251)
    # UDC deterministic address: deployer=0, salt, class_hash, calldata
    address = compute_address(
        salt=salt,
        class_hash=STEALTH_ACCOUNT_CLASS_HASH,
        constructor_calldata=calldata,
        deployer_address=0
    )
    return hex(address)

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN GASLESS CLAIM FLOW (ATOMIC)
# ═══════════════════════════════════════════════════════════════════════════════

async def get_application_nonce(client, address: int) -> int:
    """Read application-level nonce (sn_keccak('nonce')) from storage"""
    try:
        class_hash = await client.get_class_hash_at(address)
        if not class_hash: return 0
        nonce = await client.get_storage_at(address, get_selector_from_name("nonce"), "latest")
        return nonce
    except:
        return 0

async def gasless_claim(stealth_priv: int, recipient: str, expected_amount: int):
    client = FullNodeClient(node_url=RPC_URL)
    
    if SPONSOR_ADDRESS == 0 or SPONSOR_PRIVATE_KEY == 0:
        print("❌ Sponsor config missing")
        return False

    sponsor_account = Account(
        client=client,
        address=SPONSOR_ADDRESS,
        key_pair=KeyPair.from_private_key(SPONSOR_PRIVATE_KEY),
        chain=StarknetChainId.SEPOLIA
    )

    stealth_pub = derive_public_key(stealth_priv)
    stealth_address_hex = compute_stealth_address(stealth_pub)
    stealth_address_int = int(stealth_address_hex, 16)

    print(f"\n[Stealth Account] {stealth_address_hex}")
    
    # Check Balance
    balance = 0
    try:
        bal_resp = await client.call_contract(Call(
            to_addr=STRK_TOKEN, selector=get_selector_from_name("balanceOf"), calldata=[stealth_address_int]
        ))
        balance = bal_resp[0]
        print(f"  Balance: {balance/1e18} STRK")
    except Exception as e:
        print(f"  Balance check error: {e}")
        print("  Balance: 0 (or error)")

    if balance == 0:
        if expected_amount > 0:
            print("❌ No funds to claim!")
            return False

    # Check Deployed
    is_deployed = False
    try:
        if await client.get_class_hash_at(stealth_address_int): is_deployed = True
    except: pass
    
    nonce = await get_application_nonce(client, stealth_address_int)
    print(f"  Deployed: {is_deployed}, Nonce: {nonce}")

    # Prepare Data
    contract_fee = GAS_REIMBURSEMENT
    tx_amount = expected_amount if expected_amount > 0 else (balance - contract_fee)
    
    if tx_amount <= 0:
        print("❌ Amount <= 0 (insufficient for gas)")
        return False
        
    recipient_int = int(recipient, 16)
    
    # Hash Params (Poseidon)
    amount_low = tx_amount & ((1 << 128) - 1)
    amount_high = tx_amount >> 128
    fee_low = contract_fee & ((1 << 128) - 1)
    fee_high = contract_fee >> 128
    
    msg_hash = poseidon_hash_many([
        recipient_int,
        amount_low, amount_high,
        fee_low, fee_high,
        STRK_TOKEN,
        nonce
    ])
    
    print(f"  Msg Hash: {hex(msg_hash)}")
    
    # Sign (User Action)
    signature_data = get_garaga_signature_calldata(msg_hash, stealth_priv)
    
    # Build Sponsor Calls
    calls = []
    
    if not is_deployed:
        print("  📝 Adding UDC Deploy")
        x_low = stealth_pub[0] & ((1 << 128) - 1)
        x_high = stealth_pub[0] >> 128
        y_low = stealth_pub[1] & ((1 << 128) - 1)
        y_high = stealth_pub[1] >> 128
        salt = stealth_pub[0] % (2**251)
        
        calls.append(Call(
            to_addr=UDC_ADDRESS,
            selector=get_selector_from_name("deployContract"),
            calldata=[STEALTH_ACCOUNT_CLASS_HASH, salt, 0, 4, x_low, x_high, y_low, y_high]
        ))

    # Atomic Claim Call
    # signature_len, sig..., token, recipient, amount_l, amount_h, fee_l, fee_h
    atomic_calldata = [len(signature_data)] + signature_data + [
        STRK_TOKEN, recipient_int, amount_low, amount_high, fee_low, fee_high
    ]
    
    calls.append(Call(
        to_addr=stealth_address_int,
        selector=get_selector_from_name("process_atomic_claim"),
        calldata=atomic_calldata
    ))
    
    # Execute Sponsor TX
    print(f"  🚀 Executing Atomic Transaction via Sponsor...")
    try:
        # Use execute_v3 with full ResourceBoundsMapping (starknet-py 0.29.x)
        result = await sponsor_account.execute_v3(
            calls=calls,
            resource_bounds=ResourceBoundsMapping(
                l1_gas=ResourceBounds(max_amount=5000, max_price_per_unit=200_000_000_000_000),
                l1_data_gas=ResourceBounds(max_amount=50000, max_price_per_unit=200_000_000_000_000),
                l2_gas=ResourceBounds(max_amount=30_000_000, max_price_per_unit=10_000_000_000)
            )
        )
        print(f"  TX Hash: {hex(result.transaction_hash)}")
        
        await client.wait_for_tx(result.transaction_hash)
        print("  ✅ Claim Successful!")
        return True
    
    except Exception as e:
        print(f"  ❌ Transaction Failed: {e}")
        return False

async def main():
    print("\n" + "="*60)
    print("  StealthFlow Gasless Claim - Manual Execution")
    print("="*60)
    
    parser = argparse.ArgumentParser(
        description="Claim funds from a StealthFlow stealth address.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  Sweep all funds:
    python3 gasless_claim.py --stealth-priv 0x1234...abcd --to 0xrecipient...
  
  Transfer specific amount:
    python3 gasless_claim.py --stealth-priv 0x1234...abcd --to 0xrecipient... --amount 1000000000000000000
        """
    )
    parser.add_argument(
        "--stealth-priv", 
        required=True,
        help="Stealth private key (hex format, provided by sender)"
    )
    parser.add_argument(
        "--to", 
        required=True,
        help="Recipient address (your wallet address)"
    )
    parser.add_argument(
        "--amount", 
        default="0", 
        help="Amount to transfer in wei (0 = sweep all available funds minus gas)"
    )
    
    args = parser.parse_args()
    
    # Validate inputs
    stealth_priv = args.stealth_priv
    if not stealth_priv.startswith("0x"):
        stealth_priv = "0x" + stealth_priv
    
    recipient = args.to
    if not recipient.startswith("0x"):
        recipient = "0x" + recipient
    
    try:
        stealth_priv_int = int(stealth_priv, 16)
    except ValueError:
        print("\n❌ Invalid stealth private key format. Must be a hex string.")
        sys.exit(1)
    
    try:
        amount = int(args.amount)
    except ValueError:
        print("\n❌ Invalid amount. Must be an integer (in wei).")
        sys.exit(1)
    
    # Check sponsor configuration
    if SPONSOR_ADDRESS == 0 or SPONSOR_PRIVATE_KEY == 0:
        print("\n❌ Sponsor configuration missing!")
        print("\nPlease set the following environment variables:")
        print("  export SPONSOR_ADDRESS=0x...")
        print("  export SPONSOR_PRIVATE_KEY=0x...")
        print("\nThese are provided by the sender or the StealthFlow service.")
        sys.exit(1)
    
    print(f"\n📋 Claim Details:")
    print(f"   Recipient: {recipient}")
    print(f"   Amount: {'Sweep All' if amount == 0 else f'{amount} wei ({amount/1e18:.6f} STRK)'}")
    print(f"   Sponsor: {hex(SPONSOR_ADDRESS)}")
    
    # Execute claim
    success = await gasless_claim(stealth_priv_int, recipient, amount)
    
    if success:
        print("\n" + "="*60)
        print("  🎉 Claim completed successfully!")
        print("="*60 + "\n")
        sys.exit(0)
    else:
        print("\n" + "="*60)
        print("  ❌ Claim failed. Check the error messages above.")
        print("="*60 + "\n")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
