#[cfg(test)]
mod tests {
    use stealth_flow::crypto::secp256k1_utils::{compute_view_tag, SECP256K1_CURVE_ID};
    
    #[test]
    fn test_view_tag_computation() {
        // Test that view tag extraction works correctly
        // For a u256 with high = 0xAB..., the view tag should be 0xAB
        let shared_secret_x = u256 {
            low: 0x1234567890abcdef1234567890abcdef,
            high: 0xAB123456789012345678901234567890, // MSB is 0xAB
        };
        
        let view_tag = compute_view_tag(shared_secret_x);
        assert(view_tag == 0xAB, 'Wrong view tag');
    }
    
    #[test]
    fn test_curve_id() {
        // Verify secp256k1 curve ID is correct
        assert(SECP256K1_CURVE_ID == 2, 'Wrong curve ID');
    }
}
