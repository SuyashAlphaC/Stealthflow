use starknet::ContractAddress;

#[starknet::interface]
pub trait IStealthAnnouncer<TContractState> {
    fn announce(
        ref self: TContractState,
        scheme_id: u256,
        ephemeral_pubkey: Array<u256>,
        ciphertext: Array<u256>,
        view_tag: u8
    );
}

#[starknet::interface]
pub trait IERC20<TContractState> {
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
}

#[derive(Serde, Drop, Copy)]
pub struct PragmaPricesResponse {
    pub price: u128,
    pub decimals: u32,
    pub last_updated_timestamp: u64,
    pub num_sources_aggregated: u32,
}

#[starknet::interface]
pub trait IPragmaOracle<TContractState> {
    fn get_data_median(self: @TContractState, pair_id: felt252) -> PragmaPricesResponse;
}

#[starknet::interface]
pub trait ISRC5<TContractState> {
    fn supports_interface(self: @TContractState, interface_id: felt252) -> bool;
}

#[starknet::interface]
pub trait IStealthAccountAtomic<TContractState> {
    fn process_atomic_claim(
        ref self: TContractState,
        signature: Array<felt252>,
        token: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
        fee: u256
    );
}
