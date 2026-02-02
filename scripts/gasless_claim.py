#!/usr/bin/env python3
"""
StealthFlow Gasless Claim Script

Implements true gasless claims where a backend sponsor account pays for:
1. Deploying the StealthAccount via UDC
2. The stealth account then transfers funds to recipient

The stealth account reimburses the sponsor from its balance.

Usage:
    python3 gasless_claim.py --stealth-priv <STEALTH_PRIV> --to <RECIPIENT>
"""

import os
import sys
import asyncio
import argparse
import dataclasses
from starknet_py.net.full_node_client import FullNodeClient
from starknet_py.net.account.account import Account
from starknet_py.net.models import StarknetChainId
from starknet_py.net.signer.stark_curve_signer import KeyPair, StarkCurveSigner
from starknet_py.contract import Contract
from starknet_py.hash.address import compute_address
from starknet_py.net.client_models import Call, ResourceBounds, ResourceBoundsMapping

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Sepolia RPC - use Alchemy or other provider
RPC_URL = os.environ.get("STARKNET_RPC_URL", "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/LfKXerIDAvp3ToDzzjfD8")

# Stealth Account Class Hash (deployed on Sepolia)
STEALTH_ACCOUNT_CLASS_HASH = 0x12cdffb7d81d52c38f0c7fa382ab698ccf50d69b7509080a8b3a656b106d003

# STRK Token on Sepolia
STRK_TOKEN = 0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d

# Universal Deployer Contract (Sepolia)
UDC_ADDRESS = 0x041a78e741e5af2fec34b637d19f86f528d2495b879f0bc15624d63d397b5d21

# Backend Sponsor Account - must be funded with STRK
# Set via environment variables for security
SPONSOR_ADDRESS = int(os.environ.get("SPONSOR_ADDRESS", "0x0"), 16)
SPONSOR_PRIVATE_KEY = int(os.environ.get("SPONSOR_PRIVATE_KEY", "0x0"), 16)

# Gas cost estimate in STRK (0.01 STRK should be plenty)
GAS_REIMBURSEMENT = 10_000_000_000_000_000  # 0.01 STRK

# ═══════════════════════════════════════════════════════════════════════════════
# SECP256K1 UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
G_X = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
G_Y = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8

def modinv(a, m):
    if a < 0:
        a = a % m
    g, x, _ = extended_gcd(a, m)
    if g != 1:
        raise Exception('Modular inverse does not exist')
    return x % m

def extended_gcd(a, b):
    if a == 0:
        return b, 0, 1
    gcd, x1, y1 = extended_gcd(b % a, a)
    return gcd, y1 - (b // a) * x1, x1

def point_add(p1, p2):
    if p1 is None:
        return p2
    if p2 is None:
        return p1
    x1, y1 = p1
    x2, y2 = p2
    if x1 == x2:
        if y1 == y2:
            lam = (3 * x1 * x1) * modinv(2 * y1, P) % P
        else:
            return None
    else:
        lam = (y2 - y1) * modinv(x2 - x1, P) % P
    x3 = (lam * lam - x1 - x2) % P
    y3 = (lam * (x1 - x3) - y1) % P
    return (x3, y3)

def point_mul(k, point):
    result = None
    addend = point
    while k:
        if k & 1:
            result = point_add(result, addend)
        addend = point_add(addend, addend)
        k >>= 1
    return result

def derive_public_key(priv_key: int) -> tuple:
    """Derive secp256k1 public key from private key"""
    return point_mul(priv_key, (G_X, G_Y))

# ═══════════════════════════════════════════════════════════════════════════════
# GARAGA SIGNATURE GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def get_garaga_signature_calldata(msg_hash: int, priv_key: int) -> list:
    """Generate Garaga signature hints"""
    from garaga.starknet.tests_and_calldata_generators.signatures import ECDSASignature, CurveID
    import random
    
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
    return list(sig.serialize_with_hints())

# ═══════════════════════════════════════════════════════════════════════════════
# STEALTH ADDRESS COMPUTATION
# ═══════════════════════════════════════════════════════════════════════════════

def compute_stealth_address(stealth_pub: tuple) -> str:
    """Compute the stealth account address from the public key"""
    x_low = stealth_pub[0] & ((1 << 128) - 1)
    x_high = stealth_pub[0] >> 128
    y_low = stealth_pub[1] & ((1 << 128) - 1)
    y_high = stealth_pub[1] >> 128
    constructor_calldata = [x_low, x_high, y_low, y_high]
    
    salt = stealth_pub[0] % (2**251)
    
    address = compute_address(
        salt=salt,
        class_hash=STEALTH_ACCOUNT_CLASS_HASH,
        constructor_calldata=constructor_calldata,
        deployer_address=0
    )
    return hex(address)

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN GASLESS CLAIM FLOW
# ═══════════════════════════════════════════════════════════════════════════════

async def gasless_claim(stealth_priv: int, recipient: str):
    """
    Execute gasless claim:
    1. Sponsor deploys StealthAccount via UDC
    2. Stealth account transfers to recipient
    3. Stealth account reimburses sponsor
    """
    
    print("=" * 70)
    print("STEALTHFLOW GASLESS CLAIM")
    print("=" * 70)
    
    # Derive stealth public key
    stealth_pub = derive_public_key(stealth_priv)
    stealth_address = compute_stealth_address(stealth_pub)
    
    print(f"\n[Stealth Account]")
    print(f"  Address: {stealth_address}")
    print(f"  Recipient: {recipient}")
    
    # Connect to RPC
    client = FullNodeClient(node_url=RPC_URL)
    
    # Check if sponsor is configured
    if SPONSOR_ADDRESS == 0 or SPONSOR_PRIVATE_KEY == 0:
        print("\n❌ ERROR: Sponsor account not configured!")
        print("   Set SPONSOR_ADDRESS and SPONSOR_PRIVATE_KEY env vars")
        return False
    
    # Create sponsor account
    sponsor_signer = StarkCurveSigner(
        account_address=SPONSOR_ADDRESS,
        key_pair=KeyPair.from_private_key(SPONSOR_PRIVATE_KEY),
        chain_id=StarknetChainId.SEPOLIA
    )
    sponsor_account = Account(
        address=SPONSOR_ADDRESS,
        client=client,
        signer=sponsor_signer,
        chain=StarknetChainId.SEPOLIA
    )
    
    print(f"\n[Sponsor Account]")
    print(f"  Address: {hex(SPONSOR_ADDRESS)}")
    
    # 1. Check stealth account balance
    from starknet_py.hash.selector import get_selector_from_name
    
    bal_resp = await client.call_contract(
        Call(
            to_addr=STRK_TOKEN,
            selector=get_selector_from_name("balanceOf"),
            calldata=[int(stealth_address, 16)]
        )
    )
    balance = bal_resp[0] + (bal_resp[1] << 128)
    print(f"\n[Stealth Balance]")
    print(f"  {balance / 10**18:.6f} STRK")
    
    if balance == 0:
        print("\n❌ No funds to claim!")
        return False
    
    # 2. Check if already deployed
    is_deployed = False
    try:
        class_hash = await client.get_class_hash_at(stealth_address)
        if class_hash:
            is_deployed = True
            print("\n✅ Account already deployed")
    except:
        print("\n📦 Account not deployed - will deploy via UDC")
    
    # 3. Deploy via UDC if needed (using SPONSOR account)
    if not is_deployed:
        print("\n[Step 1] Deploying Stealth Account via UDC...")
        
        # Prepare constructor calldata
        x_low = stealth_pub[0] & ((1 << 128) - 1)
        x_high = stealth_pub[0] >> 128
        y_low = stealth_pub[1] & ((1 << 128) - 1)
        y_high = stealth_pub[1] >> 128
        
        salt = stealth_pub[0] % (2**251)
        
        # UDC.deployContract call
        # Calldata: class_hash, salt, unique (true=1), constructor_calldata_len, ...constructor_calldata
        deploy_call = Call(
            to_addr=UDC_ADDRESS,
            selector=get_selector_from_name("deployContract"),
            calldata=[
                STEALTH_ACCOUNT_CLASS_HASH,  # class_hash
                salt,                         # salt
                0,                            # unique = false (deterministic address)
                4,                            # calldata_len
                x_low, x_high, y_low, y_high  # constructor args
            ]
        )
        
        try:
            # Execute via sponsor account
            tx = await sponsor_account.execute_v3(
                calls=[deploy_call],
                auto_estimate=True
            )
            print(f"  Deploy TX: {hex(tx.transaction_hash)}")
            
            print("  Waiting for confirmation...")
            await client.wait_for_tx(tx.transaction_hash)
            print("  ✅ Deployed!")
            is_deployed = True
        except Exception as e:
            print(f"  ❌ Deploy failed: {e}")
            return False
    
    # 4. Transfer from stealth account to recipient
    if is_deployed:
        print("\n[Step 2] Transferring funds to recipient...")
        
        recipient_int = int(recipient, 16)
        
        # Calculate transfer amount (balance - gas reimbursement)
        transfer_amount = balance - GAS_REIMBURSEMENT
        if transfer_amount <= 0:
            print(f"  ❌ Balance too low to cover gas reimbursement")
            return False
        
        print(f"  Transfer: {transfer_amount / 10**18:.6f} STRK")
        print(f"  Gas Reimbursement: {GAS_REIMBURSEMENT / 10**18:.6f} STRK")
        
        # Now we need to send an invoke from the stealth account
        # The stealth account uses Garaga secp256k1 signatures
        # We need to manually construct and sign the transaction
        
        from starknet_py.net.models.transaction import InvokeV3
        
        # Build calldata for __execute__
        # Format: [call_count, to, selector, data_len, data...]
        transfer_selector = get_selector_from_name("transfer")
        calldata = [
            1,                    # 1 call
            STRK_TOKEN,           # to
            transfer_selector,    # selector
            3,                    # calldata len (recipient, amount_low, amount_high)
            recipient_int,        # recipient
            transfer_amount & ((1 << 128) - 1),  # amount low
            transfer_amount >> 128               # amount high
        ]
        
        # Get current nonce
        try:
            nonce = await client.get_contract_nonce(stealth_address)
        except:
            nonce = 0
        
        invoke_tx = InvokeV3(
            sender_address=int(stealth_address, 16),
            calldata=calldata,
            version=3,
            signature=[],
            resource_bounds=ResourceBoundsMapping(
                l1_gas=ResourceBounds(max_amount=50000, max_price_per_unit=1000000000000),
                l2_gas=ResourceBounds(max_amount=0, max_price_per_unit=0),
                l1_data_gas=ResourceBounds(max_amount=0, max_price_per_unit=0)
            ),
            nonce=nonce,
            account_deployment_data=[]
        )
        
        # Calculate hash and sign with Garaga
        invoke_hash = invoke_tx.calculate_hash(chain_id=StarknetChainId.SEPOLIA)
        print(f"  Invoke TX Hash: {hex(invoke_hash)}")
        
        sig = get_garaga_signature_calldata(invoke_hash, stealth_priv)
        invoke_tx = dataclasses.replace(invoke_tx, signature=sig)
        
        try:
            resp = await client.send_transaction(invoke_tx)
            print(f"  Transfer TX: {hex(resp.transaction_hash)}")
            
            print("  Waiting for confirmation...")
            await client.wait_for_tx(resp.transaction_hash)
            print("  ✅ Transfer complete!")
        except Exception as e:
            print(f"  ❌ Transfer failed: {e}")
            return False
    
    # 5. Reimburse sponsor (stealth account pays sponsor)
    if is_deployed and SPONSOR_ADDRESS != 0:
        print("\n[Step 3] Reimbursing sponsor...")
        
        # Build reimbursement call
        reimburse_selector = get_selector_from_name("transfer")
        reimburse_calldata = [
            1,
            STRK_TOKEN,
            reimburse_selector,
            3,
            SPONSOR_ADDRESS,
            GAS_REIMBURSEMENT & ((1 << 128) - 1),
            GAS_REIMBURSEMENT >> 128
        ]
        
        try:
            nonce = await client.get_contract_nonce(stealth_address)
        except:
            nonce = 1
        
        reimburse_tx = InvokeV3(
            sender_address=int(stealth_address, 16),
            calldata=reimburse_calldata,
            version=3,
            signature=[],
            resource_bounds=ResourceBoundsMapping(
                l1_gas=ResourceBounds(max_amount=20000, max_price_per_unit=1000000000000),
                l2_gas=ResourceBounds(max_amount=0, max_price_per_unit=0),
                l1_data_gas=ResourceBounds(max_amount=0, max_price_per_unit=0)
            ),
            nonce=nonce,
            account_deployment_data=[]
        )
        
        reimburse_hash = reimburse_tx.calculate_hash(chain_id=StarknetChainId.SEPOLIA)
        sig = get_garaga_signature_calldata(reimburse_hash, stealth_priv)
        reimburse_tx = dataclasses.replace(reimburse_tx, signature=sig)
        
        try:
            resp = await client.send_transaction(reimburse_tx)
            print(f"  Reimburse TX: {hex(resp.transaction_hash)}")
            print("  ✅ Sponsor reimbursed!")
        except Exception as e:
            print(f"  ⚠️ Reimbursement failed (non-critical): {e}")
    
    print("\n" + "=" * 70)
    print("✅ GASLESS CLAIM COMPLETE!")
    print("=" * 70)
    return True


async def main():
    parser = argparse.ArgumentParser(description="StealthFlow Gasless Claim")
    parser.add_argument("--stealth-priv", required=True, help="Stealth private key (hex)")
    parser.add_argument("--to", required=True, help="Recipient address (hex)")
    
    args = parser.parse_args()
    
    stealth_priv = int(args.stealth_priv, 16)
    recipient = args.to
    
    success = await gasless_claim(stealth_priv, recipient)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
