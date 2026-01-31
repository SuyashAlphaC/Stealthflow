#[starknet::contract]
mod StealthAccount {
    use starknet::ContractAddress;
    use starknet::account::Call;
    use starknet::get_tx_info;
    use starknet::syscalls::call_contract_syscall;
    use starknet::SyscallResultTrait;
    use super::super::crypto::secp256k1_utils::{verify_secp256k1_signature, Secp256k1PublicKey};

    #[storage]
    struct Storage {
        public_key_x: u256,
        public_key_y: u256,
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
    fn __validate_deploy__(
        ref self: ContractState, 
        class_hash: felt252, 
        salt: felt252, 
        public_key_x: u256, 
        public_key_y: u256
    ) -> felt252 {
        self.validate_transaction()
    }

    #[external(v0)]
    fn __execute__(ref self: ContractState, calls: Array<Call>) -> Array<Span<felt252>> {
        // Note: In SNIP-6, __validate__ is called by sequencer before __execute__.
        // We don't re-validate here to save gas.
        
        let mut results = ArrayTrait::new();
        let mut i = 0;
        loop {
            if i >= calls.len() {
                break;
            }
            let call = calls.at(i);
            let result = call_contract_syscall(
                *call.to, 
                *call.selector, 
                *call.calldata
            ).unwrap_syscall();
            results.append(result);
            i += 1;
        };
        results
    }

    #[generate_trait]
    impl InternalFunctions of InternalFunctionsTrait {
        fn validate_transaction(self: @ContractState) -> felt252 {
            let tx_info = get_tx_info().unbox();
            let signature = tx_info.signature;
            
            // Signature format: [r_low, r_high, s_low, s_high, ...garaga_hints]
            // Minimum 4 felts required for r and s (2 felts each for u256)
            if signature.len() < 4 {
                return 0; // Invalid signature length
            }

            let pk_x = self.public_key_x.read();
            let pk_y = self.public_key_y.read();
            let public_key = Secp256k1PublicKey { x: pk_x, y: pk_y };

            // Transaction hash as the message being signed
            let msg_hash: u256 = tx_info.transaction_hash.into();

            // Pass the entire signature span (includes r, s, and Garaga hints)
            if verify_secp256k1_signature(msg_hash, signature, public_key) {
                starknet::VALIDATED
            } else {
                0
            }
        }
    }

    // View function to get public key
    #[external(v0)]
    fn get_public_key(self: @ContractState) -> (u256, u256) {
        (self.public_key_x.read(), self.public_key_y.read())
    }
}
