#[starknet::contract(account)]
pub mod StealthAccount {
    use starknet::ContractAddress;
    use starknet::account::Call;
    use starknet::get_tx_info;
    use starknet::syscalls::call_contract_syscall;
    use starknet::SyscallResultTrait;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use garaga::signatures::ecdsa::ECDSASignatureWithHint;
    use stealth_flow::crypto::secp256k1_utils::{
        verify_secp256k1_signature, Secp256k1PublicKey, SECP256K1_CURVE_ID
    };

    // SRC-5 Interface IDs
    const ISRC5_ID: felt252 = 0x3f918d17e5ee77373b56385708f855659a07f75997f365cf87748628532a055;
    const ACCOUNT_INTERFACE_ID: felt252 = 0x2ceccef7f994940b3962a6c67e0ba4fcd37df7d131417c604f91e03caecc1cd;

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

    #[abi(embed_v0)]
    impl AccountImpl of starknet::account::AccountContract<ContractState> {
        fn __validate__(ref self: ContractState, calls: Array<Call>) -> felt252 {
            self.validate_transaction()
        }

        /// Execute a list of calls.
        /// 
        /// # Paymaster Reimbursement Pattern
        /// When using a Paymaster, the final call in `calls` should be:
        /// `token.transfer(paymaster_address, reimbursement_amount)`
        /// 
        /// This ensures the Paymaster is reimbursed atomically within the same transaction.
        /// If any call fails, the entire transaction reverts, preventing griefing.
        fn __execute__(ref self: ContractState, calls: Array<Call>) -> Array<Span<felt252>> {
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

        fn __validate_declare__(self: @ContractState, class_hash: felt252) -> felt252 {
            self.validate_transaction()
        }
    }

    // SRC-5 Interface Detection
    #[abi(embed_v0)]
    impl SRC5Impl of stealth_flow::interfaces::ISRC5<ContractState> {
        fn supports_interface(self: @ContractState, interface_id: felt252) -> bool {
            interface_id == ISRC5_ID || interface_id == ACCOUNT_INTERFACE_ID
        }
    }

    #[abi(embed_v0)]
    fn __validate_deploy__(
        ref self: ContractState, 
        class_hash: felt252, 
        salt: felt252, 
        public_key_x: u256, 
        public_key_y: u256
    ) -> felt252 {
        self.validate_transaction()
    }

    #[generate_trait]
    impl InternalFunctions of InternalFunctionsTrait {
        fn validate_transaction(self: @ContractState) -> felt252 {
            let tx_info = get_tx_info().unbox();
            let mut signature = tx_info.signature;
            
            // Deserialize ECDSASignatureWithHint from signature span
            let signature_with_hint = Serde::<ECDSASignatureWithHint>::deserialize(ref signature);
            
            if signature_with_hint.is_none() {
                return 0; // Invalid signature format
            }

            let pk_x = self.public_key_x.read();
            let pk_y = self.public_key_y.read();
            let public_key = Secp256k1PublicKey { x: pk_x, y: pk_y };

            if verify_secp256k1_signature(signature_with_hint.unwrap(), public_key) {
                starknet::VALIDATED
            } else {
                0
            }
        }
    }

    #[external(v0)]
    fn get_public_key(self: @ContractState) -> (u256, u256) {
        (self.public_key_x.read(), self.public_key_y.read())
    }
}
