use starknet::keccak::keccak_u256s_le_inputs;
use garaga::signatures::secp256k1::{Secp256k1Signature, verify_ecdsa_signature};

#[derive(Drop, Copy, Serde)]
struct Secp256k1PublicKey {
    x: u256,
    y: u256,
}

/// Computes the 1-byte view tag from the shared secret S.
/// View Tag = first byte of Keccak256(S.x) in Big-Endian interpretation.
/// u256 is stored as { low: u128, high: u128 } where `high` contains the MSB.
/// Byte 0 (Big-Endian) = (high >> 120) & 0xFF.
fn compute_view_tag(shared_secret_x: u256) -> u8 {
    let input = array![shared_secret_x];
    let hash = keccak_u256s_le_inputs(input.span());
    
    // Extract Byte 0 (Big-Endian): The MSB of the hash.
    // hash.high contains the most significant 128 bits.
    // Byte 0 is at bits 127..120 of high (i.e., high >> 120).
    let high = hash.high;
    
    // Right-shift by 120 bits to get the first byte.
    // u128 has 128 bits. Shifting right by 120 leaves the top 8 bits.
    let tag_u128 = high / 0x1000000000000000000000000000000_u128; // 2^120
    
    tag_u128.try_into().unwrap()
}

/// Verifies a secp256k1 signature using Garaga's optimized verification.
/// 
/// # Arguments
/// * `msg_hash` - The hash of the message being verified.
/// * `signature_with_hints` - A span containing the full signature data:
///     - r (u256): 2 felts
///     - s (u256): 2 felts
///     - Garaga hints: remaining felts
/// * `public_key` - The secp256k1 public key.
/// 
/// # Returns
/// `true` if the signature is valid, `false` otherwise.
fn verify_secp256k1_signature(
    msg_hash: u256,
    signature_with_hints: Span<felt252>,
    public_key: Secp256k1PublicKey
) -> bool {
    // Signature format: [r_low, r_high, s_low, s_high, ...hints]
    // We need at least 4 felts for r and s (u256 each = 2 felts each)
    if signature_with_hints.len() < 4 {
        return false;
    }
    
    // Parse r (u256)
    let r_low: u128 = (*signature_with_hints.at(0)).try_into().unwrap();
    let r_high: u128 = (*signature_with_hints.at(1)).try_into().unwrap();
    let r = u256 { low: r_low, high: r_high };
    
    // Parse s (u256)
    let s_low: u128 = (*signature_with_hints.at(2)).try_into().unwrap();
    let s_high: u128 = (*signature_with_hints.at(3)).try_into().unwrap();
    let s = u256 { low: s_low, high: s_high };
    
    // Extract hints (remaining elements)
    let hints = signature_with_hints.slice(4, signature_with_hints.len() - 4);
    
    // Create the Garaga signature struct
    let signature = Secp256k1Signature { r, s };
    
    // Create the public key point
    let pubkey_point = garaga::definitions::G1Point { x: public_key.x, y: public_key.y };
    
    // Call Garaga's verify_ecdsa_signature
    // This function uses the hints for optimized non-native field arithmetic.
    verify_ecdsa_signature(msg_hash, signature, pubkey_point, hints)
}
