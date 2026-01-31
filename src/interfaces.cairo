use starknet::ContractAddress;

#[starknet::interface]
trait IStealthAnnouncer<TContractState> {
    fn announce(
        ref self: TContractState,
        scheme_id: u256,
        ephemeral_pubkey: Array<u256>,
        ciphertext: Array<u256>,
        view_tag: u8
    );
}

#[starknet::interface]
trait IERC20<TContractState> {
    fn balanceOf(self: @TContractState, account: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transferFrom(ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
}
