#[starknet::contract]
pub mod StealthAnnouncer {
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use stealth_flow::interfaces::IStealthAnnouncer;

    #[storage]
    struct Storage {}

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Announcement: Announcement,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Announcement {
        #[key]
        pub scheme_id: u256,
        #[key]
        pub view_tag: u8,
        pub ephemeral_pubkey: Array<u256>,
        pub ciphertext: Array<u256>,
        pub caller: ContractAddress,
    }

    #[abi(embed_v0)]
    impl StealthAnnouncerImpl of IStealthAnnouncer<ContractState> {
        fn announce(
            ref self: ContractState,
            scheme_id: u256,
            ephemeral_pubkey: Array<u256>,
            ciphertext: Array<u256>,
            view_tag: u8
        ) {
            let caller = get_caller_address();
            self.emit(Announcement {
                scheme_id,
                view_tag,
                ephemeral_pubkey,
                ciphertext,
                caller
            });
        }
    }
}
