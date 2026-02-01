"""
StealthFlow SDK - Stealth Address Generation and Garaga Signature Hints
"""
import hashlib
import random
from typing import Tuple, Optional, List

# --- secp256k1 curve parameters ---
P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
G_X = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
G_Y = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8
G = (G_X, G_Y)

# --- EC Point Math ---
def point_add(p1, p2):
    if p1 is None: return p2
    if p2 is None: return p1
    (x1, y1), (x2, y2) = p1, p2
    if x1 == x2 and y1 != y2: return None
    if x1 == x2:
        m = (3 * x1 * x1) * pow(2 * y1, P - 2, P)
    else:
        m = (y1 - y2) * pow(x1 - x2, P - 2, P)
    x3 = (m * m - x1 - x2) % P
    y3 = (m * (x1 - x3) - y1) % P
    return (x3, y3)

def point_mul(k, p):
    r = None
    for i in range(256):
        if (k >> i) & 1:
            r = point_add(r, p)
        p = point_add(p, p)
    return r

def generate_keypair():
    priv = random.randrange(1, N)
    pub = point_mul(priv, G)
    return priv, pub

def keccak256(data: bytes) -> bytes:
    """Keccak256 hash using pycryptodome."""
    try:
        from Crypto.Hash import keccak
        k = keccak.new(digest_bits=256)
        k.update(data)
        return k.digest()
    except ImportError:
        k = hashlib.sha3_256()
        k.update(data)
        return k.digest()

# --- ECDSA Signing ---
def sign_message(msg_hash: int, priv_key: int) -> Tuple[int, int, int]:
    """Sign a message hash with secp256k1 private key. Returns (r, s, v)."""
    while True:
        k = random.randrange(1, N)
        R = point_mul(k, G)
        r = R[0] % N
        if r == 0:
            continue
        k_inv = pow(k, N - 2, N)
        s = (k_inv * (msg_hash + r * priv_key)) % N
        if s == 0:
            continue
        # Compute recovery parameter v (0 or 1)
        v = R[1] % 2
        # Ensure low-S for malleability protection
        if s > N // 2:
            s = N - s
            v = 1 - v  # Flip v
        return r, s, v


# --- Garaga Signature Hint Generation ---
def get_garaga_signature_calldata(msg_hash: int, priv_key: int) -> List[int]:
    """
    Sign message and generate Garaga signature calldata with hints.
    
    Uses Garaga's ECDSASignature.serialize_with_hints() for real hint generation.
    
    Returns: List of felts to be used as the 'signature' field in Starknet transaction.
    """
    # 1. Sign the message
    r, s, v = sign_message(msg_hash, priv_key)
    
    # 2. Get public key
    pub = point_mul(priv_key, G)
    px, py = pub
    
    # 3. Use Garaga to generate hints
    from garaga.starknet.tests_and_calldata_generators.signatures import (
        ECDSASignature, 
        CurveID
    )
    
    # Create ECDSASignature with all required parameters
    sig = ECDSASignature(
        r=r,
        s=s,
        v=v,
        px=px,
        py=py,
        z=msg_hash,  # z is the message hash
        curve_id=CurveID.SECP256K1
    )
    
    # Generate calldata with hints
    calldata = sig.serialize_with_hints()
    
    return list(calldata)

# --- Stealth Address Logic ---
def generate_stealth_address(
    view_pub: Tuple[int, int], 
    spend_pub: Tuple[int, int], 
) -> Tuple[Tuple[int, int], Tuple[int, int], int, int]:
    """Generate a stealth address for a recipient."""
    ephemeral_priv = random.randrange(1, N)
    ephemeral_pub = point_mul(ephemeral_priv, G)
    
    # Shared Secret S = r * View_Pub
    shared_secret_point = point_mul(ephemeral_priv, view_pub)
    s_x = shared_secret_point[0]
    
    s_bytes = s_x.to_bytes(32, 'big')
    hashed_s = keccak256(s_bytes)
    
    # View Tag = first byte (Big-Endian)
    view_tag = hashed_s[0]
    hashed_scalar = int.from_bytes(hashed_s, 'big')
    
    # P = Spend_Pub + hash(S) * G
    part2 = point_mul(hashed_scalar % N, G)
    stealth_pub = point_add(spend_pub, part2)
    
    return stealth_pub, ephemeral_pub, view_tag, ephemeral_priv

def check_stealth_payment(
    view_priv: int,
    spend_pub: Tuple[int, int],
    ephemeral_pub: Tuple[int, int],
    view_tag: int
) -> Optional[int]:
    """Check if a stealth payment belongs to the recipient."""
    shared_secret_point = point_mul(view_priv, ephemeral_pub)
    s_x = shared_secret_point[0]
    
    s_bytes = s_x.to_bytes(32, 'big')
    hashed_s = keccak256(s_bytes)
    
    if hashed_s[0] == view_tag:
        return int.from_bytes(hashed_s, 'big')
    return None

def compute_stealth_priv_key(spend_priv: int, shared_secret_hash: int) -> int:
    """Derive the stealth private key."""
    return (spend_priv + shared_secret_hash) % N

# --- Test Vector Generation for Cairo ---
def generate_test_cheatcodes(tx_hash: int, priv_key: int, pub_key: Tuple[int, int] = None) -> str:
    """
    Generate Cairo-formatted test cheatcodes for integration tests.
    
    Args:
        tx_hash: The transaction hash to sign
        priv_key: The private key to sign with
        pub_key: Optional public key (computed if not provided)
    
    Returns:
        Formatted Cairo code snippet for copy-paste into tests
    """
    if pub_key is None:
        pub_key = point_mul(priv_key, G)
    
    calldata = get_garaga_signature_calldata(tx_hash, priv_key)
    
    # Format as Cairo array
    lines = [
        "// Generated by stealth_sdk.py generate_test_cheatcodes()",
        f"// tx_hash: {hex(tx_hash)}",
        f"// pub_key_x: {hex(pub_key[0])}",
        f"// pub_key_y: {hex(pub_key[1])}",
        "",
        "let signature: Array<felt252> = array![",
    ]
    
    for i, felt in enumerate(calldata):
        comma = "," if i < len(calldata) - 1 else ""
        lines.append(f"    {felt}{comma}")
    
    lines.append("];")
    lines.append("")
    lines.append(f"// Public key for StealthAccount deployment:")
    lines.append(f"let pub_key_x_low: u128 = {pub_key[0] & ((1 << 128) - 1)};")
    lines.append(f"let pub_key_x_high: u128 = {pub_key[0] >> 128};")
    lines.append(f"let pub_key_y_low: u128 = {pub_key[1] & ((1 << 128) - 1)};")
    lines.append(f"let pub_key_y_high: u128 = {pub_key[1] >> 128};")
    
    return "\n".join(lines)


def print_test_vector(tx_hash: int = None, priv_key: int = None):
    """Print a complete test vector for Cairo integration tests."""
    if priv_key is None:
        priv_key = random.randrange(1, N)
    if tx_hash is None:
        tx_hash = 0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7
    
    print("\n" + "=" * 70)
    print("CAIRO TEST VECTOR (copy-paste into tests/test_stealth.cairo)")
    print("=" * 70)
    print(generate_test_cheatcodes(tx_hash, priv_key))
    print("=" * 70)


# --- Demo ---
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--test-vector":
        # Generate test vector mode
        print_test_vector()
        sys.exit(0)
    
    print("=" * 60)
    print("StealthFlow SDK Demo (with Real Garaga Hints)")
    print("=" * 60)
    
    # 1. User Setup (Bob)
    bob_view_priv, bob_view_pub = generate_keypair()
    bob_spend_priv, bob_spend_pub = generate_keypair()
    print(f"\n[Setup] Bob's View Pub: ({hex(bob_view_pub[0])[:18]}...)")
    print(f"[Setup] Bob's Spend Pub: ({hex(bob_spend_pub[0])[:18]}...)")
    
    # 2. Alice sends to Bob
    print("\n[Alice] Generating stealth address...")
    stealth_pub, ephemeral_pub, tag, _ = generate_stealth_address(bob_view_pub, bob_spend_pub)
    print(f"[Alice] Stealth Pub: ({hex(stealth_pub[0])[:18]}...)")
    print(f"[Alice] View Tag: {tag}")
    
    # 3. Bob scans
    print("\n[Bob] Scanning announcements...")
    shared_hash = check_stealth_payment(bob_view_priv, bob_spend_pub, ephemeral_pub, tag)
    
    if shared_hash:
        print("✓ Match found!")
        stealth_priv = compute_stealth_priv_key(bob_spend_priv, shared_hash)
        derived_pub = point_mul(stealth_priv, G)
        print(f"✓ Key derivation verified: {derived_pub == stealth_pub}")
        
        # 4. Generate Garaga signature for claim transaction
        print("\n[Bob] Generating Garaga signature for claim tx...")
        msg_hash = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
        
        try:
            calldata = get_garaga_signature_calldata(msg_hash, stealth_priv)
            print(f"✓ Signature calldata generated!")
            print(f"  Total felts: {len(calldata)}")
            print(f"  Ready for on-chain verification with Garaga")
            
            # Show test vector generation hint
            print("\n[Tip] Run 'python3 scripts/stealth_sdk.py --test-vector' for Cairo test code")
        except Exception as e:
            print(f"✗ Error generating hints: {e}")
    else:
        print("✗ No match")
    
    print("\n" + "=" * 60)

