/**
 * Starknet Contract Integration
 */
import { RpcProvider } from 'starknet';

// Contract addresses - Sepolia Testnet
export const CONTRACTS = {
    STEALTH_ANNOUNCER: '0x01f79771a9767967bc76997a7370117f6c7c5896df675af50ac22f3150caf58a',
    STEALTH_PAYMASTER: '0x0', // Update with your deployed paymaster address
    STEALTH_ACCOUNT_CLASS_HASH: '0x12cdffb7d81d52c38f0c7fa382ab698ccf50d69b7509080a8b3a656b106d003',
    // Token addresses
    ETH: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    STRK: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
};

// StealthAnnouncer ABI (minimal for events and announce function)
export const STEALTH_ANNOUNCER_ABI = [
    {
        name: 'announce',
        type: 'function',
        inputs: [
            { name: 'scheme_id', type: 'core::integer::u256' },
            { name: 'ephemeral_pubkey', type: 'core::array::Array::<core::integer::u256>' },
            { name: 'ciphertext', type: 'core::array::Array::<core::integer::u256>' },
            { name: 'view_tag', type: 'core::integer::u8' },
        ],
        outputs: [],
        state_mutability: 'external',
    },
    {
        name: 'Announcement',
        type: 'event',
        kind: 'struct',
        members: [
            { name: 'scheme_id', type: 'core::integer::u256', kind: 'key' },
            { name: 'view_tag', type: 'core::integer::u8', kind: 'key' },
            { name: 'ephemeral_pubkey', type: 'core::array::Array::<core::integer::u256>', kind: 'data' },
            { name: 'ciphertext', type: 'core::array::Array::<core::integer::u256>', kind: 'data' },
            { name: 'caller', type: 'core::starknet::contract_address::ContractAddress', kind: 'data' },
        ],
    },
];

// StealthPaymaster ABI
export const STEALTH_PAYMASTER_ABI = [
    {
        name: 'calculate_required_fee',
        type: 'function',
        inputs: [
            { name: 'max_fee_strk', type: 'core::integer::u256' },
            { name: 'token_address', type: 'core::starknet::contract_address::ContractAddress' },
        ],
        outputs: [{ type: 'core::integer::u256' }],
        state_mutability: 'view',
    },
    {
        name: 'validate_paymaster_transaction',
        type: 'function',
        inputs: [
            { name: 'token_address', type: 'core::starknet::contract_address::ContractAddress' },
            { name: 'sender', type: 'core::starknet::contract_address::ContractAddress' },
            { name: 'max_fee', type: 'core::integer::u256' },
            { name: 'provided_amount', type: 'core::integer::u256' },
        ],
        outputs: [{ type: 'core::bool' }],
        state_mutability: 'external',
    },
    {
        name: 'is_token_whitelisted',
        type: 'function',
        inputs: [
            { name: 'token', type: 'core::starknet::contract_address::ContractAddress' },
        ],
        outputs: [{ type: 'core::bool' }],
        state_mutability: 'view',
    },
];

// Provider for reading events
// Using endpoints that support CORS for browser requests
export function getProvider(network: 'mainnet' | 'sepolia' = 'sepolia'): RpcProvider {
    // Use public endpoints that support CORS
    // Options: Alchemy, Blast, Infura
    const nodeUrl = network === 'mainnet'
        ? 'https://starknet-mainnet.public.blastapi.io/rpc/v0_7'
        : 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';

    return new RpcProvider({ nodeUrl });
}

// Announcement event type
export interface AnnouncementEvent {
    schemeId: bigint;
    viewTag: number;
    ephemeralPubkey: [bigint, bigint];
    ciphertext: bigint[];
    caller: string;
    blockNumber: number;
    txHash: string;
}

// Parse announcement events from block range
export async function fetchAnnouncements(
    provider: RpcProvider,
    fromBlock: number,
    toBlock: number
): Promise<AnnouncementEvent[]> {
    const events = await provider.getEvents({
        address: CONTRACTS.STEALTH_ANNOUNCER,
        from_block: { block_number: fromBlock },
        to_block: { block_number: toBlock },
        chunk_size: 100
    });

    return events.events.map((event) => {
        return {
            schemeId: BigInt(event.keys[1]),
            viewTag: Number(event.keys[2]),
            // Ensure ephemeralPubkey matches [bigint, bigint]
            ephemeralPubkey: [BigInt(event.data[0]), BigInt(event.data[1])] as [bigint, bigint],
            ciphertext: event.data.slice(2, event.data.length - 1).map(x => BigInt(x)),
            caller: event.data[event.data.length - 1],
            // Fix: Fallback to 0 if block_number is undefined
            blockNumber: event.block_number ?? 0,
            txHash: event.transaction_hash
        };
    });
}