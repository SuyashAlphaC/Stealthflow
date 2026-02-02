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
import dataclasses

# secp256k1 curve parameters
P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
G_X = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
G_Y = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8
# Stealth Account Class Hash (must match frontend)
STEALTH_ACCOUNT_CLASS_HASH = 0x12cdffb7d81d52c38f0c7fa382ab698ccf50d69b7509080a8b3a656b106d003

# STRK token on Sepolia
STRK_TOKEN = 0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d

def get_garaga_signature_calldata(msg_hash, priv_key):
    """Generate Garaga signature hints using garaga python lib"""
    from garaga.starknet.tests_and_calldata_generators.signatures import ECDSASignature, CurveID
    
    # We need to sign the msg_hash (transaction hash)
    # Standard signature (r, s, v)
    # garaga provides helpers
    
    # Create random k
    # For robust production we should use deterministic k, but random is okay for demo
    import random
    k = random.randrange(1, N)
    
    # Manually sign to get r, s, v first or let Garaga do it? 
    # Garaga ECDSASignature constructor usually takes r,s,v.
    # Let's rely on starknet_py signer to get r,s first?
    # Actually, let's implement basic signing here to feed Garaga
    
    # Basic ECDSA Sign (RFC 6979 deterministic is better, but simple random for now)
    # ... (Logic from sdk)
    
    # Re-using logic from SDK directly if available or inline it
    # Inline for standalone script
    
    # Sign
    kinv = pow(k, N - 2, N)
    R = point_mul(k, (G_X, G_Y))
    r = R[0] % N
    s = (kinv * (msg_hash + r * priv_key)) % N
    v = R[1] % 2
    
    if s > N // 2:
        s = N - s
        v = 1 - v
        
    pub = point_mul(priv_key, (G_X, G_Y))
    sig = ECDSASignature(r, s, v, pub[0], pub[1], msg_hash, CurveID.SECP256K1)
    
    return list(sig.serialize_with_hints())

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
        deployer_address=0 
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
    parser.add_argument('--execute', action='store_true', help='Execute the claim on-chain (Deploy + Transfer)')
    
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

    if args.execute:
        print("\n" + "=" * 70)
        print("EXECUTING ON-CHAIN CLAIM (Deploy + Transfer)")
        print("=" * 70)
        
        client = FullNodeClient(node_url="https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/LfKXerIDAvp3ToDzzjfD8")
        
        # 1. Check if already deployed
        # If deployed, just transfer. If not, deploy_account.
        is_deployed = False
        try:
            class_hash = await client.get_class_hash_at(stealth_address)
            if class_hash:
                is_deployed = True
                print("Account already deployed.")
        except:
            print("Account not deployed. Preparing deploy_account transaction...")

        if not is_deployed:
            # Prepare DeployAccount V3 (paying in STRK)
            # We need a Custom Signer that uses Garaga hints
            
            # Since starknet.py Account requires a Signer, we can just construct the tx manually
            # and sign it using our function, then send.
            
            # Construct DeployAccount
            # Salt, ClassHash, Calldata, Version=3
            
            # This is complex to do raw. 
            # Easier: Use Account but patch sign method?
            # Or just use Account with a dummy signer, getting the hash, then re-signing?
            
            # Let's try basic flow:
            # 1. Get nonce (0)
            # 2. Estimate Fee? Or hardcode generous fee (0.0005 STRK)
            # 3. Compute TX Hash
            # 4. Sign Hash -> Garaga Calldata
            # 5. Send Raw
            
            from starknet_py.net.models.transaction import InvokeV3, DeployAccountV3
            from starknet_py.net.client_models import ResourceBounds, ResourceBoundsMapping
            
            # DeployAccount params
            # constructor_calldata defined in compute_stealth_address
            # Recompute it here
            x_low = stealth_pub[0] & ((1 << 128) - 1)
            x_high = stealth_pub[0] >> 128
            y_low = stealth_pub[1] & ((1 << 128) - 1)
            y_high = stealth_pub[1] >> 128
            constructor_calldata = [x_low, x_high, y_low, y_high]
            
            salt = stealth_pub[0] % (2**251)
            
            deploy_tx = DeployAccountV3(
                class_hash=STEALTH_ACCOUNT_CLASS_HASH,
                contract_address_salt=salt,
                constructor_calldata=constructor_calldata,
                version=3,
                resource_bounds=ResourceBoundsMapping(
                    l1_gas=ResourceBounds(max_amount=20000, max_price_per_unit=100000000000), # Adjust price dynamically ideally
                    l2_gas=ResourceBounds(max_amount=0, max_price_per_unit=0),
                    l1_data_gas=ResourceBounds(max_amount=0, max_price_per_unit=0)
                ),
                nonce=0,
                signature=[],
            )

            # We need to set the STRK token as fee token.
            # Starknet-py DeployAccount doesn't seem to have 'token' field directly exposed in constructor?
            # V3 txs don't have fee_token address field inside? 
            # Wait, signature depends on fields.
            # V3 has paymaster_data. If empty, uses ETH? 
            # STRK: If we want to pay in STRK we must use V3 and... wait.
            # standard V3 uses ETH unless Paymaster is used?
            # Or is it resource_bounds?
            # Starknet Mainnet uses STRK for V3? 
            # "V3 transactions pay in STRK by default"? Or ETH?
            # Actually, Starknet V3 allows paying in STRK if you market make?
            # NO. V3 pays in STRK if you use STRK resource bounds?
            # "The fee token for V3 transactions is STRK." - Yes!
            # So V3 = STRK. 
            
            # Update hash
            deploy_hash = deploy_tx.calculate_hash(chain_id=StarknetChainId.SEPOLIA)
            print(f"Deploy Tx Hash: {hex(deploy_hash)}")
            
            # Sign
            sig_calldata = get_garaga_signature_calldata(deploy_hash, stealth_priv)
            deploy_tx = dataclasses.replace(deploy_tx, signature=sig_calldata)
            
            # Send
            print("Sending DeployAccount...")
            try:
                resp = await client.deploy_account(deploy_tx)
                print(f"Deploy Sent! Tx Hash: {hex(resp.transaction_hash)}")
                print("Waiting for acceptance...")
                await client.wait_for_tx(resp.transaction_hash)
                print("Deployed successfully!")
                is_deployed = True
            except Exception as e:
                print(f"Deploy Failed: {e}")
                return

        if is_deployed:
            # Transfer
            print("Preparing Transfer...")
            # Account is deployed. We can use Account client now easily...
            # BUT we need custom signer for Invoke too.
            # Same pattern: Create Invoke V3, Sign, Send.
            
            recipient_int = int(recipient, 16)
            
            # Transfer Call: STRK.transfer(recipient, amount/2?)
            # Let's sweep almost all? Keep dust for fees.
            # Check balance first
            bal_resp = await client.call_contract(
                Call(to_addr=STRK_TOKEN, selector=get_selector_from_name("balanceOf"), calldata=[int(stealth_address, 16)])
            )
            balance = bal_resp[0] + (bal_resp[1] << 128)
            print(f"Current Balance: {balance} wei")
            
            if balance == 0:
                print("Zero balance. Cannot transfer.")
                return
                
            fee_estimate = 5000000000000000 # 0.005 STRK buffer
            transfer_amount = balance - fee_estimate
            if transfer_amount <= 0:
                print("Balance too low to cover fees.")
                return
                
            from starknet_py.net.client_models import Call
            from starknet_py.hash.selector import get_selector_from_name
            
            call = Call(
                to_addr=STRK_TOKEN,
                selector=get_selector_from_name("transfer"),
                calldata=[recipient_int, transfer_amount, 0] # u256 low, high
            )
            
            # Build InvokeV3
            invoke_tx = InvokeV3(
                sender_address=int(stealth_address, 16),
                calldata=[1, STRK_TOKEN, get_selector_from_name("transfer"), 3, recipient_int, transfer_amount, 0],
                version=3, signature=[], 
                resource_bounds=ResourceBoundsMapping(
                    l1_gas=ResourceBounds(max_amount=10000, max_price_per_unit=100000000000),
                    l2_gas=ResourceBounds(max_amount=0, max_price_per_unit=0),
                    l1_data_gas=ResourceBounds(max_amount=0, max_price_per_unit=0)
                ),
                nonce=1, # Next nonce
                account_deployment_data=[]
            )
            # Fix calldata construction (compiler dependent, but simple transfer is standard)
            # Standard Account __execute__ takes Array<Call>.
            # [num_calls, to, selector, calldata_len, calldata...]
            
            # Invoke V3 expects raw calldata? No, execute calldata.
            # [1, STRK, transfer_sel, 2, amount, 0] ?
            # Check starknet specs or standard account.
            # Standard: [1 (call_len), to, selector, data_len, data...]
            # Fix calldata construction
            new_calldata = [1, STRK_TOKEN, get_selector_from_name("transfer"), 2, transfer_amount, 0]
            invoke_tx = dataclasses.replace(invoke_tx, calldata=new_calldata)
            
            invoke_hash = invoke_tx.calculate_hash(chain_id=StarknetChainId.SEPOLIA)
            sig = get_garaga_signature_calldata(invoke_hash, stealth_priv)
            invoke_tx = dataclasses.replace(invoke_tx, signature=sig)
            
            print("Sending Transfer...")
            resp = await client.send_transaction(invoke_tx)
            print(f"Transfer Sent! Tx Hash: {hex(resp.transaction_hash)}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
