#[starknet::contract]
pub mod StealthPaymaster {
    use starknet::ContractAddress;
    use starknet::get_contract_address;
    use starknet::get_caller_address;
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess, StorageMapWriteAccess};
    use stealth_flow::interfaces::{IERC20Dispatcher, IERC20DispatcherTrait};

    #[storage]
    struct Storage {
        whitelisted_tokens: Map<ContractAddress, bool>,
        owner: ContractAddress,
        oracle_address: ContractAddress,
        oracle_pair_id: felt252,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState, 
        owner: ContractAddress, 
        oracle_address: ContractAddress, 
        pair_id: felt252, 
        initial_tokens: Array<ContractAddress>
    ) {
        self.owner.write(owner);
        self.oracle_address.write(oracle_address);
        self.oracle_pair_id.write(pair_id);
        
        let mut i = 0;
        loop {
            if i >= initial_tokens.len() {
                break;
            }
            let token = *initial_tokens.at(i);
            self.whitelisted_tokens.write(token, true);
            i += 1;
        };
    }

    #[external(v0)]
    fn validate_paymaster_transaction(
        ref self: ContractState, 
        token_address: ContractAddress,
        sender: ContractAddress,
        required_amount: u256
    ) -> bool {
        // 1. Whitelist Check
        let is_whitelisted = self.whitelisted_tokens.read(token_address);
        assert(is_whitelisted, 'Token not whitelisted');

        // 2. Balance Check
        let token_dispatcher = IERC20Dispatcher { contract_address: token_address };
        let sender_balance = token_dispatcher.balance_of(sender);
        assert(sender_balance >= required_amount, 'Insufficient sender balance');
        
        true
    }
    
    #[external(v0)]
    fn verify_reimbursement(
        ref self: ContractState,
        token_address: ContractAddress,
        expected_amount: u256,
        balance_before: u256
    ) {
        let token_dispatcher = IERC20Dispatcher { contract_address: token_address };
        let this_contract = get_contract_address();
        let balance_after = token_dispatcher.balance_of(this_contract);

        assert(balance_after >= balance_before + expected_amount, 'Paymaster not reimbursed');
    }

    #[external(v0)]
    fn set_whitelisted_token(ref self: ContractState, token: ContractAddress, is_whitelisted: bool) {
        let caller = get_caller_address();
        assert(caller == self.owner.read(), 'Not owner');
        self.whitelisted_tokens.write(token, is_whitelisted);
    }

    #[external(v0)]
    fn update_oracle(ref self: ContractState, new_oracle: ContractAddress, new_pair_id: felt252) {
        let caller = get_caller_address();
        assert(caller == self.owner.read(), 'Not owner');
        self.oracle_address.write(new_oracle);
        self.oracle_pair_id.write(new_pair_id);
    }
    
    #[external(v0)]
    fn is_token_whitelisted(self: @ContractState, token: ContractAddress) -> bool {
        self.whitelisted_tokens.read(token)
    }
}
