#[starknet::contract]
pub mod StealthPaymaster {
    use starknet::ContractAddress;
    use starknet::get_contract_address;
    use starknet::get_caller_address;
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess, StorageMapWriteAccess};
    use stealth_flow::interfaces::{
        IERC20Dispatcher, IERC20DispatcherTrait,
        IPragmaOracleDispatcher, IPragmaOracleDispatcherTrait
    };

    // Price pair IDs for Pragma Oracle (example values)
    const STRK_USD_PAIR_ID: felt252 = 'STRK/USD';
    const SAFETY_MARGIN_BPS: u256 = 1100; // 110% = 10% safety margin
    const BPS_DENOMINATOR: u256 = 1000;

    #[storage]
    struct Storage {
        whitelisted_tokens: Map<ContractAddress, bool>,
        token_pair_ids: Map<ContractAddress, felt252>, // Token -> Oracle Pair ID
        owner: ContractAddress,
        oracle_address: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState, 
        owner: ContractAddress, 
        oracle_address: ContractAddress, 
        initial_tokens: Array<ContractAddress>,
        token_pair_ids: Array<felt252>
    ) {
        self.owner.write(owner);
        self.oracle_address.write(oracle_address);
        
        let mut i = 0;
        loop {
            if i >= initial_tokens.len() {
                break;
            }
            let token = *initial_tokens.at(i);
            self.whitelisted_tokens.write(token, true);
            if i < token_pair_ids.len() {
                self.token_pair_ids.write(token, *token_pair_ids.at(i));
            }
            i += 1;
        };
    }

    // Internal implementation
    #[generate_trait]
    impl InternalFunctions of InternalFunctionsTrait {
        /// Calculate required token amount to cover gas fees.
        /// Uses Pragma Oracle for real-time price data with 10% safety margin.
        fn calculate_required_fee_internal(
            self: @ContractState,
            max_fee_strk: u256,
            token_address: ContractAddress
        ) -> u256 {
            let oracle = IPragmaOracleDispatcher { 
                contract_address: self.oracle_address.read() 
            };
            
            // Get STRK/USD price
            let strk_price_response = oracle.get_data_median(STRK_USD_PAIR_ID);
            let strk_price: u256 = strk_price_response.price.into();
            
            // Get Token/USD price
            let token_pair_id = self.token_pair_ids.read(token_address);
            let token_price_response = oracle.get_data_median(token_pair_id);
            let token_price: u256 = token_price_response.price.into();
            
            // Calculate: required_tokens = max_fee_strk * strk_price / token_price
            let strk_value_usd = max_fee_strk * strk_price;
            let required_tokens = strk_value_usd / token_price;
            
            // Apply 10% safety margin
            let required_with_margin = required_tokens * SAFETY_MARGIN_BPS / BPS_DENOMINATOR;
            
            required_with_margin
        }
    }

    /// External view for fee calculation
    #[external(v0)]
    fn calculate_required_fee(
        self: @ContractState,
        max_fee_strk: u256,
        token_address: ContractAddress
    ) -> u256 {
        self.calculate_required_fee_internal(max_fee_strk, token_address)
    }

    /// Validate a paymaster transaction with dynamic pricing.
    #[external(v0)]
    fn validate_paymaster_transaction(
        ref self: ContractState, 
        token_address: ContractAddress,
        sender: ContractAddress,
        max_fee: u256,
        provided_amount: u256
    ) -> bool {
        // 1. Whitelist Check
        let is_whitelisted = self.whitelisted_tokens.read(token_address);
        assert(is_whitelisted, 'Token not whitelisted');

        // 2. Calculate required fee with oracle
        let required_amount = self.calculate_required_fee_internal(max_fee, token_address);
        assert(provided_amount >= required_amount, 'Insufficient provided amount');

        // 3. Balance Check on sender
        let token_dispatcher = IERC20Dispatcher { contract_address: token_address };
        let sender_balance = token_dispatcher.balance_of(sender);
        assert(sender_balance >= provided_amount, 'Insufficient sender balance');
        
        true
    }
    
    /// Verify paymaster was reimbursed after execution.
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
    
    /// Get the current balance snapshot for atomic verification.
    #[external(v0)]
    fn get_balance_snapshot(self: @ContractState, token_address: ContractAddress) -> u256 {
        let token_dispatcher = IERC20Dispatcher { contract_address: token_address };
        let this_contract = get_contract_address();
        token_dispatcher.balance_of(this_contract)
    }

    // --- Admin Functions ---
    
    #[external(v0)]
    fn set_whitelisted_token(
        ref self: ContractState, 
        token: ContractAddress, 
        is_whitelisted: bool,
        pair_id: felt252
    ) {
        let caller = get_caller_address();
        assert(caller == self.owner.read(), 'Not owner');
        self.whitelisted_tokens.write(token, is_whitelisted);
        self.token_pair_ids.write(token, pair_id);
    }

    #[external(v0)]
    fn update_oracle(ref self: ContractState, new_oracle: ContractAddress) {
        let caller = get_caller_address();
        assert(caller == self.owner.read(), 'Not owner');
        self.oracle_address.write(new_oracle);
    }
    
    #[external(v0)]
    fn is_token_whitelisted(self: @ContractState, token: ContractAddress) -> bool {
        self.whitelisted_tokens.read(token)
    }
}
