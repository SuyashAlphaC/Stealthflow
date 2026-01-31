#[starknet::contract]
mod StealthPaymaster {
    use starknet::ContractAddress;
    use starknet::get_tx_info;
    use starknet::get_contract_address;
    use super::super::interfaces::{IERC20Dispatcher, IERC20DispatcherTrait};

    #[storage]
    struct Storage {
        whitelisted_tokens: LegacyMap<ContractAddress, bool>,
        owner: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress, initial_tokens: Array<ContractAddress>) {
        self.owner.write(owner);
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
    fn __validate_deploy__(ref self: ContractState, class_hash: felt252, salt: felt252, public_key: felt252) -> felt252 {
        starknet::VALIDATED
    }

    #[external(v0)]
    fn __validate_paymaster_transaction__(ref self: ContractState, calls: Array<felt252>) -> (felt252, Array<felt252>) {
        let tx_info = get_tx_info().unbox();
        let paymaster_data = tx_info.paymaster_data;

        // Expect paymaster_data to contain [token_address, max_amount_low, max_amount_high]
        // Starknet paymaster data is variable. Let's assume protocol:
        // Index 0: Token Address
        // Index 1: Price / Amount / or just rely on execution?
        // User check requirement: "The reimbursement_token is on an approved whitelist".
        
        if paymaster_data.len() < 1 {
           panic(array!['Invalid paymaster data']);
        }
        let token_address: ContractAddress = (*paymaster_data.at(0)).try_into().unwrap();
        
        // 1. Whitelist Check
        let is_whitelisted = self.whitelisted_tokens.read(token_address);
        assert(is_whitelisted, 'Token not whitelisted');

        // 2. Sender Balance Check
        // "StealthAccount actually holds sufficient balance"
        // Sender is `account_contract_address`.
        let sender = tx_info.account_contract_address;
        let max_fee = tx_info.max_fee; // In WEI (STRK/ETH)
        // We need to know how much TOKEN is required.
        // Simplified: Assume strictly 1:1 or just check if sender has *some* balance > max_fee?
        // Or paymaster_data includes the 'amount_to_pay'.
        // Let's assume paymaster_data[1] is amount_low, [2] is amount_high (u256).
        // If not provided, we might default to max_fee if token is compatible, but safe to require explicit amount.
        
        let required_amount: u256 = if paymaster_data.len() >= 3 {
             u256 { low: (*paymaster_data.at(1)).try_into().unwrap(), high: (*paymaster_data.at(2)).try_into().unwrap() }
        } else {
             u256 { low: max_fee.try_into().unwrap(), high: 0 } // Fallback to max_fee if u128
        };

        let token_dispatcher = IERC20Dispatcher { contract_address: token_address };
        let sender_balance = token_dispatcher.balanceOf(sender);
        assert(sender_balance >= required_amount, 'Insufficient sender balance');

        // 3. Prepare Context for Post-Execution
        // Context: [token_address_felt, expected_amount_low, expected_amount_high, paymaster_balance_before_low, paymaster_balance_before_high]
        let this_contract = get_contract_address();
        let paymaster_balance_before = token_dispatcher.balanceOf(this_contract);
        
        let mut context = ArrayTrait::new();
        context.append(token_address.into());
        context.append(required_amount.low.into());
        context.append(required_amount.high.into());
        context.append(paymaster_balance_before.low.into());
        context.append(paymaster_balance_before.high.into());

        (starknet::VALIDATED, context)
    }

    #[external(v0)]
    fn __post_execution__(ref self: ContractState, context: Array<felt252>) {
        // Atomic transfer_on_claim logic verification
        // "Reverts if Paymaster is not reimbursed"
        
        if context.len() < 5 {
             panic(array!['Invalid context']);
        }
        let token_address: ContractAddress = (*context.at(0)).try_into().unwrap();
        let expected_amount = u256 { low: (*context.at(1)).try_into().unwrap(), high: (*context.at(2)).try_into().unwrap() };
        let balance_before = u256 { low: (*context.at(3)).try_into().unwrap(), high: (*context.at(4)).try_into().unwrap() };

        let token_dispatcher = IERC20Dispatcher { contract_address: token_address };
        let this_contract = get_contract_address();
        let balance_after = token_dispatcher.balanceOf(this_contract);

        // Check verification
        assert(balance_after >= balance_before + expected_amount, 'Paymaster not reimbursed');
    }
}
