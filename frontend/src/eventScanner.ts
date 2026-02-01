/**
 * StealthFlow Event Scanner Utilities
 * Handles parsing of Starknet event data for stealth address detection
 */
import { Point } from './stealth-crypto';

/**
 * Parse ephemeral_pubkey Array<u256> from Starknet event to secp256k1 Point.
 * 
 * Contract emits ephemeral_pubkey as Array<u256> which can be:
 * - 2 elements: [x, y] as full u256 values
 * - 4 elements: [x_low, x_high, y_low, y_high] as split 128-bit values
 * 
 * @param data - Array of bigints from the event
 * @returns Point with x and y coordinates
 * @throws Error if array length is invalid
 */
export function parseEphemeralPubkeyFromEvent(data: bigint[]): Point {
    if (data.length === 2) {
        // Simple format: [x, y] as full u256 values
        return { x: data[0], y: data[1] };
    } else if (data.length === 4) {
        // Split u256 format: [x_low, x_high, y_low, y_high]
        // Reconstruct: value = low + (high << 128)
        const x = data[0] + (data[1] << BigInt(128));
        const y = data[2] + (data[3] << BigInt(128));
        return { x, y };
    }
    throw new Error(`Invalid ephemeral_pubkey format: expected 2 or 4 elements, got ${data.length}`);
}

/**
 * Format Point as Array<u256> for contract calls.
 * Uses simple [x, y] format.
 * 
 * @param point - secp256k1 Point
 * @returns Array of two bigints [x, y]
 */
export function formatPointForContract(point: Point): bigint[] {
    return [point.x, point.y];
}

/**
 * Format Point as split u256 format for Starknet contracts.
 * 
 * @param point - secp256k1 Point
 * @returns Array of four bigints [x_low, x_high, y_low, y_high]
 */
export function formatPointForContractSplit(point: Point): bigint[] {
    const MASK_128 = (BigInt(1) << BigInt(128)) - BigInt(1);
    return [
        point.x & MASK_128,           // x_low
        point.x >> BigInt(128),       // x_high
        point.y & MASK_128,           // y_low
        point.y >> BigInt(128)        // y_high
    ];
}

/**
 * Interface for parsed Announcement events from StealthAnnouncer contract
 */
export interface AnnouncementEvent {
    schemeId: bigint;
    viewTag: number;
    ephemeralPubkey: Point;
    ciphertext: bigint[];
    caller: string;
    txHash: string;
    blockNumber: number;
}

/**
 * Parse raw Starknet event data into AnnouncementEvent.
 * 
 * @param rawEvent - Raw event object from Starknet provider
 * @returns Parsed AnnouncementEvent
 */
export function parseAnnouncementEvent(rawEvent: {
    keys: bigint[];
    data: bigint[];
    transaction_hash: string;
    block_number: number;
}): AnnouncementEvent {
    // Keys contain indexed fields: scheme_id (u256: 2 felts), view_tag (u8: 1 felt)
    // Note: u256 in Cairo is split into low and high parts
    const schemeId = rawEvent.keys[1] + (rawEvent.keys[2] << BigInt(128));
    const viewTag = Number(rawEvent.keys[3]);

    // Data contains: ephemeral_pubkey (Array<u256>), ciphertext (Array<u256>), caller
    // Arrays are prefixed with length in Cairo serialization
    const ephemeralLen = Number(rawEvent.data[0]);
    const ephemeralData = rawEvent.data.slice(1, 1 + ephemeralLen);

    const ciphertextStart = 1 + ephemeralLen;
    const ciphertextLen = Number(rawEvent.data[ciphertextStart]);
    const ciphertext = rawEvent.data.slice(ciphertextStart + 1, ciphertextStart + 1 + ciphertextLen);

    const callerIdx = ciphertextStart + 1 + ciphertextLen;
    const caller = '0x' + rawEvent.data[callerIdx].toString(16);

    return {
        schemeId,
        viewTag,
        ephemeralPubkey: parseEphemeralPubkeyFromEvent(Array.from(ephemeralData)),
        ciphertext: Array.from(ciphertext),
        caller,
        txHash: rawEvent.transaction_hash,
        blockNumber: rawEvent.block_number
    };
}
