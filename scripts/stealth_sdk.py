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
    """Keccak256 hash. Uses sha3_256 as approximation if eth-hash unavailable."""
    try:
        from Crypto.Hash import keccak
        k = keccak.new(digest_bits=256)
        k.update(data)
        return k.digest()
    except ImportError:
        # Fallback to sha3_256 (not exact Keccak but close for demo)
        k = hashlib.sha3_256()
        k.update(data)
        return k.digest()

# --- ECDSA Signing ---
def sign_message(msg_hash: int, priv_key: int) -> Tuple[int, int]:
    """Sign a message hash with secp256k1 private key. Returns (r, s)."""
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
        # Ensure low-S for malleability protection
        if s > N // 2:
            s = N - s
        return r, s

# --- Garaga Signature Hint Generation ---
def u256_to_felt_pair(value: int) -> Tuple[int, int]:
    """Convert u256 to (low, high) felt pair."""
    low = value & ((1 << 128) - 1)
    high = value >> 128
    return low, high

def get_garaga_signature_calldata(msg_hash: int, priv_key: int) -> List[int]:
    """
    Sign message and generate Garaga signature calldata with hints.
    
    Returns: List of felts [r_low, r_high, s_low, s_high, ...hints]
    This is the format expected by StealthAccount.__validate__
    """
    # 1. Sign the message
    r, s = sign_message(msg_hash, priv_key)
    
    # 2. Convert r and s to felt pairs
    r_low, r_high = u256_to_felt_pair(r)
    s_low, s_high = u256_to_felt_pair(s)
    
    # 3. Generate Garaga hints using the Garaga Python SDK
    try:
        from garaga.hints.io import to_calldata
        from garaga.definitions import CURVES, CurveID, G1Point
        from garaga.starknet.groth16_contract_generator.calldata import gen_groth16_calldata
        
        # Get the public key for hint generation
        pub = point_mul(priv_key, G)
        
        # Generate verification hints using Garaga's internal functions
        # This generates the non-deterministic hints needed for on-chain verification
        from garaga.hints.ecdsa import get_ecdsa_verify_calldata
        
        hints = get_ecdsa_verify_calldata(
            msg_hash=msg_hash,
            r=r,
            s=s,
            public_key_x=pub[0],
            public_key_y=pub[1],
            curve_id=CurveID.SECP256K1
        )
        
    except ImportError:
        # Garaga not installed - generate placeholder hints
        # In production, Garaga MUST be installed
        print("WARNING: Garaga not installed. Using placeholder hints.")
        # Placeholder hints structure (actual hints would be much larger)
        hints = [0] * 20  # Dummy hints
    
    # Combine into final calldata format
    calldata = [r_low, r_high, s_low, s_high] + list(hints)
    return calldata

# --- Stealth Address Logic ---
def generate_stealth_address(
    view_pub: Tuple[int, int], 
    spend_pub: Tuple[int, int], 
) -> Tuple[Tuple[int, int], Tuple[int, int], int, int]:
    """
    Generate a stealth address for a recipient.
    
    Returns: (Stealth PubKey P, Ephemeral PubKey R, View Tag, Ephemeral Priv r)
    """
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
    """
    Check if a stealth payment belongs to the recipient.
    Returns shared secret hash if match, None otherwise.
    """
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

# --- Demo ---
if __name__ == "__main__":
    print("--- StealthFlow SDK Demo ---\n")
    
    # 1. User Setup (Bob)
    bob_view_priv, bob_view_pub = generate_keypair()
    bob_spend_priv, bob_spend_pub = generate_keypair()
    print(f"Bob View Pub: ({hex(bob_view_pub[0])[:20]}..., {hex(bob_view_pub[1])[:20]}...)")
    print(f"Bob Spend Pub: ({hex(bob_spend_pub[0])[:20]}..., {hex(bob_spend_pub[1])[:20]}...)")
    
    # 2. Alice sends to Bob
    print("\n[Alice] Generating stealth address...")
    stealth_pub, ephemeral_pub, tag, r_priv = generate_stealth_address(bob_view_pub, bob_spend_pub)
    print(f"Stealth Pub: ({hex(stealth_pub[0])[:20]}..., {hex(stealth_pub[1])[:20]}...)")
    print(f"View Tag: {tag}")
    
    # 3. Bob scans
    print("\n[Bob] Scanning announcements...")
    shared_hash = check_stealth_payment(bob_view_priv, bob_spend_pub, ephemeral_pub, tag)
    
    if shared_hash:
        print("✓ Match found!")
        stealth_priv = compute_stealth_priv_key(bob_spend_priv, shared_hash)
        derived_pub = point_mul(stealth_priv, G)
        print(f"✓ Key derivation verified: {derived_pub == stealth_pub}")
        
        # 4. Demo Garaga signature generation
        print("\n[Bob] Generating signature for claim transaction...")
        msg_hash = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
        calldata = get_garaga_signature_calldata(msg_hash, stealth_priv)
        print(f"Signature calldata length: {len(calldata)} felts")
        print(f"  r_low: {hex(calldata[0])[:20]}...")
        print(f"  r_high: {hex(calldata[1])}")
        print(f"  s_low: {hex(calldata[2])[:20]}...")
        print(f"  s_high: {hex(calldata[3])}")
        print(f"  hints: [{len(calldata) - 4} elements]")
    else:
        print("✗ No match")
