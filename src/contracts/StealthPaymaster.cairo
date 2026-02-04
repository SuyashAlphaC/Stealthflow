#[starknet::contract]
pub mod StealthPaymaster {
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use stealth_flow::interfaces::{
        IERC20Dispatcher, IERC20DispatcherTrait, IPragmaOracleDispatcher,
        IPragmaOracleDispatcherTrait,
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
        // Pending reimbursement tracking: (token, account) -> expected_amount
        pending_reimbursements: Map<(ContractAddress, ContractAddress), u256>,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        oracle_address: ContractAddress,
        initial_tokens: Array<ContractAddress>,
        token_pair_ids: Array<felt252>,
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
        /// Power of 10 helper for decimal scaling
        fn pow_10(exp: u256) -> u256 {
            let mut result: u256 = 1;
            let mut i: u256 = 0;
            loop {
                if i >= exp {
                    break;
                }
                result = result * 10;
                i += 1;
            }
            result
        }

        /// Calculate required token amount to cover gas fees.
        /// Uses Pragma Oracle for real-time price data with 10% safety margin.
        /// Properly normalizes decimals between different price feeds.
        fn calculate_required_fee_internal(
            self: @ContractState, max_fee_strk: u256, token_address: ContractAddress,
        ) -> u256 {
            let oracle = IPragmaOracleDispatcher { contract_address: self.oracle_address.read() };

            // Get STRK/USD price with decimals
            let strk_price_response = oracle.get_data_median(STRK_USD_PAIR_ID);
            let strk_price: u256 = strk_price_response.price.into();
            let strk_decimals: u256 = strk_price_response.decimals.into();

            // Get Token/USD price with decimals
            let token_pair_id = self.token_pair_ids.read(token_address);
            let token_price_response = oracle.get_data_median(token_pair_id);
            let token_price: u256 = token_price_response.price.into();
            let token_decimals: u256 = token_price_response.decimals.into();

            // Normalize decimals for cross-price conversion:
            // required_tokens = max_fee * (strk_price / 10^strk_dec) / (token_price / 10^token_dec)
            //                 = max_fee * strk_price * 10^token_dec / (token_price * 10^strk_dec)
            let numerator = max_fee_strk * strk_price * Self::pow_10(token_decimals);
            let denominator = token_price * Self::pow_10(strk_decimals);
            let required_tokens = numerator / denominator;

            // Apply 10% safety margin
            let required_with_margin = required_tokens * SAFETY_MARGIN_BPS / BPS_DENOMINATOR;

            required_with_margin
        }
    }

    /// External view for fee calculation
    #[external(v0)]
    fn calculate_required_fee(
        self: @ContractState, max_fee_strk: u256, token_address: ContractAddress,
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
        provided_amount: u256,
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
        balance_before: u256,
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

    /// Record expected reimbursement before execution.
    /// This must be called before the stealth account executes its transaction.
    #[external(v0)]
    fn record_pending_reimbursement(
        ref self: ContractState,
        token_address: ContractAddress,
        account_contract_address: ContractAddress,
        expected_amount: u256,
    ) {
        let caller = get_caller_address();
        assert(caller == self.owner.read(), 'Not owner');
        self
            .pending_reimbursements
            .write((token_address, account_contract_address), expected_amount);
    }

    /// Verify reimbursement came FROM the specific account via transferFrom.
    /// This guarantees the source since only account_contract_address can authorize.
    #[external(v0)]
    fn verify_strict_reimbursement(
        ref self: ContractState,
        token_address: ContractAddress,
        account_contract_address: ContractAddress,
    ) {
        let expected = self.pending_reimbursements.read((token_address, account_contract_address));
        assert(expected > 0, 'No pending reimbursement');

        // Clear pending to prevent replay attacks
        self.pending_reimbursements.write((token_address, account_contract_address), 0);

        // Use transferFrom pattern: paymaster pulls from account
        // This guarantees the source is account_contract_address
        // The account must have approved this contract beforehand
        let token = IERC20Dispatcher { contract_address: token_address };
        let this_contract = get_contract_address();

        let success = token.transfer_from(account_contract_address, this_contract, expected);
        assert(success, 'Reimbursement transfer failed');
    }

    /// Check pending reimbursement amount for a token/account pair.
    #[external(v0)]
    fn get_pending_reimbursement(
        self: @ContractState,
        token_address: ContractAddress,
        account_contract_address: ContractAddress,
    ) -> u256 {
        self.pending_reimbursements.read((token_address, account_contract_address))
    }

    // --- Admin Functions ---

    #[external(v0)]
    fn set_whitelisted_token(
        ref self: ContractState, token: ContractAddress, is_whitelisted: bool, pair_id: felt252,
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
