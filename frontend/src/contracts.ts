import { Point } from './stealth-crypto';
import { RpcProvider, hash, CallData, num } from 'starknet';

export const CONTRACTS = {
    STEALTH_ANNOUNCER: '0x01f79771a9767967bc76997a7370117f6c7c5896df675af50ac22f3150caf58a',
    STEALTH_PAYMASTER: '0x0',
    UDC: '0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf', // Universal Deployer Contract (Sepolia)
    STEALTH_ACCOUNT_CLASS_HASH: '0x03487cf5ae2106db423e02de50b934643c63d893f816966009c7270fb159256a',
    ETH: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    STRK: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
};
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

export interface AnnouncementEvent {
    schemeId: bigint;
    viewTag: number;
    ephemeralPubkey: { x: bigint; y: bigint }; // Synced with stealth-crypto Point
    ciphertext: bigint[];
    caller: string;
    blockNumber: number;
    txHash: string;
}

export function getProvider(network: 'mainnet' | 'sepolia' = 'sepolia'): RpcProvider {
    const nodeUrl = network === 'mainnet'
        ? 'https://starknet-mainnet.public.blastapi.io/rpc/v0_7'
        : 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/LfKXerIDAvp3ToDzzjfD8';
    return new RpcProvider({ nodeUrl });
}

export async function fetchAnnouncements(
    provider: RpcProvider,
    fromBlock: number,
    toBlock: number
): Promise<AnnouncementEvent[]> {
    try {
        const events = await provider.getEvents({
            address: CONTRACTS.STEALTH_ANNOUNCER,
            from_block: { block_number: fromBlock },
            to_block: { block_number: toBlock },
            chunk_size: 100
        });

        return events.events.map((event) => {
            // Keys: [Selector, SchemeLow, SchemeHigh, ViewTag]
            const schemeId = BigInt(event.keys[1]) + (BigInt(event.keys[2]) << BigInt(128));
            const viewTag = Number(event.keys[3]);

            // Data layout: [ephArrayLen, xLow, xHigh, yLow, yHigh, cipherArrayLen, cipher0Low, cipher0High, ..., caller]
            const ephArrayLen = Number(event.data[0]);
            const x = BigInt(event.data[1]) + (BigInt(event.data[2]) << BigInt(128));
            const y = BigInt(event.data[3]) + (BigInt(event.data[4]) << BigInt(128));

            // Parse ciphertext array (each element is u256 = low + high)
            const cipherArrayLen = Number(event.data[5]);
            const ciphertext: bigint[] = [];
            for (let i = 0; i < cipherArrayLen; i++) {
                const low = BigInt(event.data[6 + i * 2] || '0');
                const high = BigInt(event.data[7 + i * 2] || '0');
                ciphertext.push(low + (high << BigInt(128)));
            }

            // Caller is the last element
            const callerIndex = 6 + cipherArrayLen * 2;
            const caller = event.data[callerIndex] || event.data[event.data.length - 1];

            return {
                schemeId,
                viewTag,
                ephemeralPubkey: { x, y },
                ciphertext,
                caller,
                blockNumber: event.block_number ?? 0,
                txHash: event.transaction_hash
            };
        });
    } catch (e) {
        console.error("Failed to fetch events:", e);
        return [];
    }
}

/**
 * Compute the deterministic Starknet contract address for a Stealth Account
 * Address = hash(deployer=0, salt=stealthPub.x, classHash, constructorCalldata)
 */
export function computeStealthAccountAddress(stealthPub: Point): string {
    const classHash = CONTRACTS.STEALTH_ACCOUNT_CLASS_HASH;

    // Salt is the X coordinate of the stealth public key (modulo 251 bits for safety)
    // Starknet field is ~251 bits. secp256k1 X is 256 bits. We must modulo.
    const saltBigInt = stealthPub.x % (BigInt(2) ** BigInt(251));
    const salt = '0x' + saltBigInt.toString(16);

    // Constructor args: [public_key_x_low, public_key_x_high, public_key_y_low, public_key_y_high]
    // Split 256-bit coordinates into u128s
    const xLow = stealthPub.x & ((BigInt(1) << BigInt(128)) - BigInt(1));
    const xHigh = stealthPub.x >> BigInt(128);
    const yLow = stealthPub.y & ((BigInt(1) << BigInt(128)) - BigInt(1));
    const yHigh = stealthPub.y >> BigInt(128);

    const constructorCalldata = CallData.compile([
        xLow.toString(),
        xHigh.toString(),
        yLow.toString(),
        yHigh.toString()
    ]);

    return hash.calculateContractAddressFromHash(
        salt,
        classHash,
        constructorCalldata,
        0 // Deployer is 0 for counterfactual deploy_account
    );
}