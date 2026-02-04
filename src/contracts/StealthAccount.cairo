#[starknet::contract(account)]
pub mod StealthAccount {
    use core::hash::{HashStateExTrait, HashStateTrait};
    use core::poseidon::PoseidonTrait;
    use garaga::signatures::ecdsa::ECDSASignatureWithHint;
    use starknet::account::Call;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::syscalls::call_contract_syscall;
    use starknet::{ContractAddress, SyscallResultTrait, get_caller_address, get_tx_info};
    use stealth_flow::crypto::secp256k1_utils::{Secp256k1PublicKey, verify_secp256k1_signature};
    use stealth_flow::interfaces::{IERC20Dispatcher, IERC20DispatcherTrait};

    const ISRC5_ID: felt252 = 0x3f918d17e5ee77373b56385708f855659a07f75997f365cf87748628532a055;
    const ACCOUNT_INTERFACE_ID: felt252 =
        0x2ceccef7f994940b3962a6c67e0ba4fcd37df7d131417c604f91e03caecc1cd;

    #[storage]
    struct Storage {
        public_key_x: u256,
        public_key_y: u256,
        nonce: felt252,
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

        fn __execute__(ref self: ContractState, calls: Array<Call>) -> Array<Span<felt252>> {
            let mut results = ArrayTrait::new();
            let mut i = 0;
            loop {
                if i >= calls.len() {
                    break;
                }
                let call = calls.at(i);
                let result = call_contract_syscall(*call.to, *call.selector, *call.calldata)
                    .unwrap_syscall();
                results.append(result);
                i += 1;
            }
            results
        }

        fn __validate_declare__(self: @ContractState, class_hash: felt252) -> felt252 {
            self.validate_transaction()
        }
    }

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
        public_key_y: u256,
    ) -> felt252 {
        self.validate_transaction()
    }

    // --- Atomic Claim Logic for Sponsor ---
    #[external(v0)]
    fn process_atomic_claim(
        ref self: ContractState,
        signature: Array<felt252>,
        token: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
        fee: u256,
    ) {
        // 1. Validate Nonce (Prevent Replay)
        let current_nonce = self.nonce.read();

        // 2. Reconstruct Message Hash
        // Hash(recipient, amount, fee, token, nonce)
        let mut state = PoseidonTrait::new();
        state = state.update_with(recipient);
        state = state.update_with(amount);
        state = state.update_with(fee);
        state = state.update_with(token);
        state = state.update_with(current_nonce);
        let msg_hash = state.finalize();

        // 3. Verify Hash Integrity (Manual Extraction)
        // Correct Indices per Garaga Cairo struct: rx(0-3), s(4-5), v(6), z(7-8)
        let sig_span = signature.span();
        assert(sig_span.len() >= 9, 'Sig too short');

        let z_low: felt252 = *sig_span[7];
        let z_high: felt252 = *sig_span[8];
        let z_val = u256 { low: z_low.try_into().unwrap(), high: z_high.try_into().unwrap() };

        // CRITICAL SECURITY CHECK
        assert(z_val == msg_hash.into(), 'Hash Mismatch');

        // 4. Verify Signature (Garaga)
        let mut signature_span = signature.span();
        let signature_with_hint_opt = Serde::<
            ECDSASignatureWithHint,
        >::deserialize(ref signature_span);
        assert(signature_with_hint_opt.is_some(), 'Invalid Sig Format');

        let signature_with_hint = signature_with_hint_opt.unwrap();

        let pk_x = self.public_key_x.read();
        let pk_y = self.public_key_y.read();
        let public_key = Secp256k1PublicKey { x: pk_x, y: pk_y };

        let is_valid = verify_secp256k1_signature(signature_with_hint, public_key);
        assert(is_valid, 'Invalid Signature');

        // 5. Update Nonce
        self.nonce.write(current_nonce + 1);

        // 6. Execute Transfers
        let token_dispatcher = IERC20Dispatcher { contract_address: token };
        let sponsor = get_caller_address();

        // Transfer to Recipient
        token_dispatcher.transfer(recipient, amount);

        // Reimburse Sponsor
        if fee > 0 {
            token_dispatcher.transfer(sponsor, fee);
        }
    }

    #[generate_trait]
    impl InternalFunctions of InternalFunctionsTrait {
        fn validate_transaction(self: @ContractState) -> felt252 {
            let tx_info = get_tx_info().unbox();
            let mut signature = tx_info.signature;
            let signature_with_hint = Serde::<ECDSASignatureWithHint>::deserialize(ref signature);
            if signature_with_hint.is_none() {
                return 0;
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

    #[external(v0)]
    fn get_nonce(self: @ContractState) -> felt252 {
        self.nonce.read()
    }
}
