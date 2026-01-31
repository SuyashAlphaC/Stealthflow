#[starknet::contract]
mod StealthAnnouncer {
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use super::super::interfaces::IStealthAnnouncer;

    #[storage]
    struct Storage {}

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Announcement: Announcement,
    }

    #[derive(Drop, starknet::Event)]
    struct Announcement {
        #[key]
        scheme_id: u256,
        #[key]
        view_tag: u8,
        ephemeral_pubkey: Array<u256>,
        ciphertext: Array<u256>,
        caller: ContractAddress,
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
