use garaga::definitions::G1Point;
use garaga::signatures::ecdsa::{ECDSASignatureWithHint, is_valid_ecdsa_signature_assuming_hash};

/// secp256k1 curve ID in Garaga
pub const SECP256K1_CURVE_ID: usize = 2;

#[derive(Drop, Copy, Serde)]
pub struct Secp256k1PublicKey {
    pub x: u256,
    pub y: u256,
}

/// Computes the 1-byte view tag from the shared secret S.
/// View Tag = first byte of Keccak256(S.x) in Big-Endian interpretation.
pub fn compute_view_tag(shared_secret_x: u256) -> u8 {
    // Extract MSB of the u256 (byte 0 in Big-Endian)
    // high contains bits 255..128, shift right by 120 to get bits 255..248
    let shift: u128 = 0x1000000000000000000000000000000; // 2^120
    let tag = shared_secret_x.high / shift;
    tag.try_into().unwrap()
}

/// Verifies a secp256k1 signature using Garaga's optimized verification.
pub fn verify_secp256k1_signature(
    signature_with_hint: ECDSASignatureWithHint,
    public_key: Secp256k1PublicKey
) -> bool {
    // Convert public key to G1Point (u384)
    let pubkey_point = G1Point {
        x: public_key.x.into(),
        y: public_key.y.into(),
    };
    
    is_valid_ecdsa_signature_assuming_hash(signature_with_hint, pubkey_point, SECP256K1_CURVE_ID)
}
