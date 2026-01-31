#[starknet::contract]
mod StealthAccount {
    use starknet::ContractAddress;
    use starknet::account::Call;
    use starknet::get_tx_info;
    use super::super::crypto::secp256k1_utils::is_valid_signature;

    #[storage]
    struct Storage {
        public_key_x: u256,
        public_key_y: u256, // Storing both coordinates for secp256k1
    }

    #[constructor]
    fn constructor(ref self: ContractState, public_key_x: u256, public_key_y: u256) {
        self.public_key_x.write(public_key_x);
        self.public_key_y.write(public_key_y);
    }

    #[external(v0)]
    fn __validate__(ref self: ContractState, calls: Array<Call>) -> felt252 {
        self.validate_transaction()
    }

    #[external(v0)]
    fn __validate_deploy__(ref self: ContractState, class_hash: felt252, salt: felt252, public_key_x: u256, public_key_y: u256) -> felt252 {
        self.validate_transaction()
    }

    #[external(v0)]
    fn __execute__(ref self: ContractState, calls: Array<Call>) -> Array<Span<felt252>> {
        let mut res = ArrayTrait::new();
        // Execute calls...
        // Basic execution loop
        // Warning: minimal implementation
        res // Return empty for now or implement loop
    }

    #[generate_trait]
    impl InternalFunctions of InternalFunctionsTrait {
        fn validate_transaction(self: @ContractState) -> felt252 {
            let tx_info = get_tx_info().unbox();
            let signature = tx_info.signature;
            // Expect signature to contain r, s (2 elts) or more if hints provided
            if signature.len() < 2 {
                return 0; // Invalid
            }
            let r = *signature.at(0);
            let s = *signature.at(1);
            let tx_hash = tx_info.transaction_hash;
            
            let pk_x = self.public_key_x.read();
            let pk_y = self.public_key_y.read();

            // Convert felt252 hash to u256 properly (usually just into)
            let msg_hash: u256 = tx_hash.into(); 

            // r and s are felt252 in signature array, convert to u256
            let r_u256: u256 = r.into();
            let s_u256: u256 = s.into();

            if is_valid_signature(msg_hash, r_u256, s_u256, pk_x, pk_y) {
                starknet::VALIDATED
            } else {
                0
            }
        }
    }
}
