#!/usr/bin/env python3
"""
StealthFlow Claim Script
Claim funds from a stealth address using Bob's private keys

Usage:
    python3 claim_stealth.py --view-priv <VIEW_PRIV> --spend-priv <SPEND_PRIV> --ephemeral-x <EPH_X> --ephemeral-y <EPH_Y> --to <RECIPIENT>
"""

import sys
import json
import argparse
from starknet_py.net.account.account import Account
from starknet_py.net.full_node_client import FullNodeClient
from starknet_py.net.models import StarknetChainId
from starknet_py.net.signer.stark_curve_signer import KeyPair
from starknet_py.contract import Contract
from starknet_py.hash.utils import compute_hash_on_elements
from starknet_py.hash.address import compute_address
import hashlib

# secp256k1 curve parameters
P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
G_X = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
G_Y = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8
# Stealth Account Class Hash (must match frontend)
STEALTH_ACCOUNT_CLASS_HASH = 0x12cdffb7d81d52c38f0c7fa382ab698ccf50d69b7509080a8b3a656b106d003
UDC_ADDRESS = 0x041a78e741e5af2fec34b637d19f86f528d2495b879f0bc15624d63d397b5d21

# STRK token on Sepolia
STRK_TOKEN = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"

def modinv(a, m):
    """Modular inverse using extended Euclidean algorithm"""
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
    x = y1 - (b // a) * x1
    y = x1
    return gcd, x, y

def point_add(p1, p2):
    """Add two points on secp256k1"""
    if p1 is None:
        return p2
    if p2 is None:
        return p1
    
    x1, y1 = p1
    x2, y2 = p2
    
    if x1 == x2 and y1 == y2:
        # Point doubling
        s = (3 * x1 * x1 * modinv(2 * y1, P)) % P
    else:
        s = ((y2 - y1) * modinv(x2 - x1, P)) % P
    
    x3 = (s * s - x1 - x2) % P
    y3 = (s * (x1 - x3) - y1) % P
    return (x3, y3)

def point_mul(k, point):
    """Scalar multiplication on secp256k1"""
    result = None
    addend = point
    while k:
        if k & 1:
            result = point_add(result, addend)
        addend = point_add(addend, addend)
        k >>= 1
    return result

def get_public_key(priv_key):
    """Get public key from private key"""
    return point_mul(priv_key, (G_X, G_Y))

def compute_stealth_priv_key(spend_priv, view_priv, ephemeral_pub):
    """
    Compute stealth private key:
    stealth_priv = spend_priv + hash(view_priv * ephemeral_pub)
    """
    # Compute shared secret
    shared = point_mul(view_priv, ephemeral_pub)
    
    # Hash the x-coordinate
    shared_x_bytes = shared[0].to_bytes(32, 'big')
    hash_bytes = hashlib.sha256(shared_x_bytes).digest()
    hash_scalar = int.from_bytes(hash_bytes, 'big') % N
    
    # Stealth private key
    stealth_priv = (spend_priv + hash_scalar) % N
    return stealth_priv

def compute_stealth_address(stealth_pub):
    """Compute Starknet contract address for Stealth Account"""
    # Salt: stealth_pub.x % (2^251)
    salt = stealth_pub[0] % (2**251)
    
    # Constructor args: [public_key_x_low, public_key_x_high, public_key_y_low, public_key_y_high]
    x_low = stealth_pub[0] & ((1 << 128) - 1)
    x_high = stealth_pub[0] >> 128
    y_low = stealth_pub[1] & ((1 << 128) - 1)
    y_high = stealth_pub[1] >> 128
    
    calldata = [x_low, x_high, y_low, y_high]
    
    address = compute_address(
        salt=salt,
        class_hash=STEALTH_ACCOUNT_CLASS_HASH,
        constructor_calldata=calldata,
        deployer_address=UDC_ADDRESS
    )
    return hex(address)

async def main():
    parser = argparse.ArgumentParser(description='Claim stealth funds')
    parser.add_argument('--view-priv', help='View private key (hex)')
    parser.add_argument('--spend-priv', help='Spend private key (hex)')
    parser.add_argument('--ephemeral-x', help='Ephemeral pubkey X (hex)')
    parser.add_argument('--ephemeral-y', help='Ephemeral pubkey Y (hex)')
    parser.add_argument('--stealth-priv', help='Direct Stealth Private Key (hex) - bypasses key derivation')
    parser.add_argument('--to', required=True, help='Recipient address (your hot wallet)')
    parser.add_argument('--amount', default='1000000000000000000', help='Amount in wei (default: 1 STRK)')
    
    args = parser.parse_args()
    
    args = parser.parse_args()
    
    recipient = args.to
    amount = int(args.amount)
    
    stealth_priv = 0
    if args.stealth_priv:
        stealth_priv = int(args.stealth_priv, 16) if args.stealth_priv.startswith('0x') else int(args.stealth_priv)
    elif args.view_priv and args.spend_priv and args.ephemeral_x and args.ephemeral_y:
        view_priv = int(args.view_priv, 16) if args.view_priv.startswith('0x') else int(args.view_priv)
        spend_priv = int(args.spend_priv, 16) if args.spend_priv.startswith('0x') else int(args.spend_priv)
        eph_x = int(args.ephemeral_x, 16) if args.ephemeral_x.startswith('0x') else int(args.ephemeral_x)
        eph_y = int(args.ephemeral_y, 16) if args.ephemeral_y.startswith('0x') else int(args.ephemeral_y)
        
        ephemeral_pub = (eph_x, eph_y)
        stealth_priv = compute_stealth_priv_key(spend_priv, view_priv, ephemeral_pub)
    else:
        print("Error: Must provide either --stealth-priv OR (--view-priv, --spend-priv, --ephemeral-x/y)")
        return
    recipient = args.to
    amount = int(args.amount)
    
    print("=" * 70)
    print("STEALTH FUND CLAIM")
    print("=" * 70)
    
    print("STEALTH FUND CLAIM")
    print("=" * 70)
    
    # Compute public key
    stealth_pub = get_public_key(stealth_priv)
    stealth_address = compute_stealth_address(stealth_pub)
    
    print(f"\n[Computed Values]")
    print(f"  Stealth Private Key: 0x{stealth_priv:064x}")
    print(f"  Stealth Public Key X: 0x{stealth_pub[0]:064x}")
    print(f"  Stealth Address: {stealth_address}")
    print(f"  Recipient: {recipient}")
    print(f"  Amount: {amount} wei ({amount / 1e18:.4f} STRK)")
    
    print("\n" + "=" * 70)
    print("NOTE: Direct ERC20 transfer requires the stealth address to be a")
    print("deployed account contract. The funds are at the stealth address but")
    print("need a StealthAccount deployed there to execute transactions.")
    print("=" * 70)
    
    # For now, just output the sncast command to deploy StealthAccount
    print("\n[Deploy StealthAccount with the stealth public key]")
    
    # StealthAccount expects (public_key_x: u256, public_key_y: u256)
    # u256 = (low: u128, high: u128)
    x_low = stealth_pub[0] & ((1 << 128) - 1)
    x_high = stealth_pub[0] >> 128
    y_low = stealth_pub[1] & ((1 << 128) - 1)
    y_high = stealth_pub[1] >> 128
    
    print(f"""
sncast deploy --network sepolia \\
  --class-hash 0x12cdffb7d81d52c38f0c7fa382ab698ccf50d69b7509080a8b3a656b106d003 \\
  --arguments '{x_low}, {x_high}, {y_low}, {y_high}'
""")
    
    print("\nAlternatively, use UDC (Universal Deployer Contract) with salt for deterministic address:")
    print(f"  Salt: 0x{stealth_pub[0] % (2**251):064x}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
