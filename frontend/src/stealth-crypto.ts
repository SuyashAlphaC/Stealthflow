/**
 * StealthFlow TypeScript Crypto Library
 * Port of stealth_sdk.py using @noble/curves for secp256k1
 */
import { secp256k1, schnorr } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

// secp256k1 curve order
const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

// Generator point G
const G_X = BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798');
const G_Y = BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8');

export interface Point {
    x: bigint;
    y: bigint;
}

export interface StealthAddress {
    stealthPub: Point;
    ephemeralPub: Point;
    viewTag: number;
    ephemeralPriv: bigint;
}

export interface KeyPair {
    privateKey: bigint;
    publicKey: Point;
}

/**
 * Convert bigint to 32-byte big-endian array
 */
export function bigIntToBytes(n: bigint): Uint8Array {
    const hex = n.toString(16).padStart(64, '0');
    return hexToBytes(hex);
}

/**
 * Convert bytes to bigint
 */
export function bytesToBigInt(bytes: Uint8Array): bigint {
    return BigInt('0x' + bytesToHex(bytes));
}

/**
 * Generate a random keypair on secp256k1
 */
export function generateKeypair(): KeyPair {
    const privateKeyBytes = secp256k1.utils.randomSecretKey();
    const privateKey = bytesToBigInt(privateKeyBytes);
    const pubPoint = secp256k1.getPublicKey(privateKeyBytes, false);
    // Parse uncompressed public key (65 bytes: 0x04 + 32 bytes x + 32 bytes y)
    const x = bytesToBigInt(pubPoint.slice(1, 33));
    const y = bytesToBigInt(pubPoint.slice(33, 65));
    return {
        privateKey,
        publicKey: { x, y }
    };
}

/**
 * Scalar multiply on secp256k1 using schnorr.Point
 */
export function pointMul(k: bigint, p: Point): Point {
    // Create point from affine coordinates
    const point = schnorr.Point.fromAffine({ x: p.x, y: p.y });
    const result = point.multiply(k);
    const affine = result.toAffine();
    return { x: affine.x, y: affine.y };
}

/**
 * Point addition on secp256k1
 */
export function pointAdd(p1: Point, p2: Point): Point {
    const point1 = schnorr.Point.fromAffine({ x: p1.x, y: p1.y });
    const point2 = schnorr.Point.fromAffine({ x: p2.x, y: p2.y });
    const result = point1.add(point2);
    const affine = result.toAffine();
    return { x: affine.x, y: affine.y };
}

/**
 * Compute Keccak256 hash
 */
export function keccak256(data: Uint8Array): Uint8Array {
    return keccak_256(data);
}

/**
 * Compute the 1-byte view tag from shared secret X coordinate
 * View Tag = first byte of keccak256(S.x) in Big-Endian
 */
export function computeViewTag(sharedSecretX: bigint): number {
    const xBytes = bigIntToBytes(sharedSecretX);
    const hash = keccak256(xBytes);
    return hash[0]; // First byte (Big-Endian)
}

/**
 * Generate a stealth address for a recipient
 * 
 * @param viewPub - Recipient's viewing public key
 * @param spendPub - Recipient's spending public key
 * @returns StealthAddress with stealth public key, ephemeral key, and view tag
 */
export function generateStealthAddress(
    viewPub: Point,
    spendPub: Point
): StealthAddress {
    // Generate ephemeral keypair
    const { privateKey: ephemeralPriv, publicKey: ephemeralPub } = generateKeypair();

    // Shared Secret S = r * V (ephemeral_priv * view_pub)
    const sharedSecret = pointMul(ephemeralPriv, viewPub);
    const sX = sharedSecret.x;

    // Hash the shared secret
    const sBytes = bigIntToBytes(sX);
    const hashedS = keccak256(sBytes);

    // View Tag = first byte
    const viewTag = hashedS[0];

    // Scalar from hash
    const hashedScalar = bytesToBigInt(hashedS) % N;

    // Stealth Public Key P = spend_pub + hash(S) * G
    const G: Point = { x: G_X, y: G_Y };
    const hashTimesG = pointMul(hashedScalar, G);
    const stealthPub = pointAdd(spendPub, hashTimesG);

    return {
        stealthPub,
        ephemeralPub,
        viewTag,
        ephemeralPriv
    };
}

/**
 * Check if a stealth payment belongs to the recipient
 * 
 * @param viewPriv - Recipient's viewing private key
 * @param _spendPub - Recipient's spending public key (unused but kept for API)
 * @param ephemeralPub - Ephemeral public key from announcement
 * @param viewTag - View tag from announcement
 * @returns Shared secret hash if match, null otherwise
 */
export function checkStealthPayment(
    viewPriv: bigint,
    _spendPub: Point,
    ephemeralPub: Point,
    viewTag: number
): { sharedSecret: Point, sharedSecretHash: bigint } | null {
    // S = v * R (view_priv * ephemeral_pub)
    const sharedSecret = pointMul(viewPriv, ephemeralPub);
    const sX = sharedSecret.x;

    // Hash
    const sBytes = bigIntToBytes(sX);
    const hashedS = keccak256(sBytes);

    // Check view tag (fast filter - only 1/256 false positives)
    if (hashedS[0] !== viewTag) {
        return null;
    }

    // Full match - return both the point (for metadata) and hash (for keys)
    return {
        sharedSecret,
        sharedSecretHash: bytesToBigInt(hashedS)
    };
}

/**
 * Derive the stealth private key
 * 
 * @param spendPriv - Spending private key
 * @param sharedSecretHash - Hash of shared secret from checkStealthPayment
 * @returns The stealth private key
 */
export function computeStealthPrivKey(
    spendPriv: bigint,
    sharedSecretHash: bigint
): bigint {
    return (spendPriv + sharedSecretHash) % N;
}

/**
 * Get public key from private key
 */
export function getPublicKey(privateKey: bigint): Point {
    const pubPoint = secp256k1.getPublicKey(bigIntToBytes(privateKey), false);
    const x = bytesToBigInt(pubPoint.slice(1, 33));
    const y = bytesToBigInt(pubPoint.slice(33, 65));
    return { x, y };
}

/**
 * Format point for display
 */
export function formatPoint(p: Point): string {
    return `(0x${p.x.toString(16).slice(0, 16)}..., 0x${p.y.toString(16).slice(0, 16)}...)`;
}

/**
 * Parse meta-address string into view and spend public keys
 * Format: "st:starknet:0xVIEW_X,VIEW_Y,SPEND_X,SPEND_Y"
 */
export function parseMetaAddress(metaAddress: string): { viewPub: Point; spendPub: Point } | null {
    try {
        const parts = metaAddress.replace('st:starknet:', '').split(',');
        if (parts.length !== 4) return null;

        return {
            viewPub: {
                x: BigInt(parts[0]),
                y: BigInt(parts[1])
            },
            spendPub: {
                x: BigInt(parts[2]),
                y: BigInt(parts[3])
            }
        };
    } catch {
        return null;
    }
}

/**
 * Generate meta-address string from keypairs
 */
export function generateMetaAddress(viewPub: Point, spendPub: Point): string {
    return `st:starknet:0x${viewPub.x.toString(16)},0x${viewPub.y.toString(16)},0x${spendPub.x.toString(16)},0x${spendPub.y.toString(16)}`;
}

/**
 * Format wei amount to human-readable token string
 * @param amountWei - Amount in wei (10^18)
 * @param decimals - Token decimals (default 18)
 * @returns Formatted string like "1.5000"
 */
export function formatWeiToToken(amountWei: bigint, decimals: number = 18): string {
    if (amountWei === BigInt(0)) return '0.0000';

    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = amountWei / divisor;
    const fraction = amountWei % divisor;
    const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 4);
    return `${whole}.${fractionStr}`;
}

/**
 * Parse token string to wei amount
 * @param amount - Amount string like "1.5" or "0.001"
 * @param decimals - Token decimals (default 18)
 * @returns Amount in wei
 */
export function parseTokenToWei(amount: string, decimals: number = 18): bigint {
    const [whole, fraction = ''] = amount.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    return BigInt(whole + paddedFraction);
}

/**
 * Encrypt metadata (amount) using shared secret
 * Uses XOR encryption with keccak256-derived mask
 * 
 * @param sharedSecretX - X coordinate of shared secret point
 * @param amountWei - Amount in wei to encrypt
 * @returns Array of encrypted u256 values
 */
export function encryptMetadata(
    sharedSecretX: bigint,
    amountWei: bigint
): bigint[] {
    // Derive encryption mask: keccak256("stealthflow:metadata" || sharedSecretX)
    const prefix = new TextEncoder().encode("stealthflow:metadata");
    const secretBytes = bigIntToBytes(sharedSecretX);
    const combined = new Uint8Array([...prefix, ...secretBytes]);
    const mask = bytesToBigInt(keccak256(combined));

    // XOR the amount with the mask
    const encryptedAmount = amountWei ^ mask;

    return [encryptedAmount];
}

/**
 * Decrypt metadata from ciphertext
 * 
 * @param sharedSecretX - X coordinate of shared secret point
 * @param ciphertext - Encrypted ciphertext array from announcement
 * @returns Decrypted amount in wei and formatted string
 */
export function decryptMetadata(
    sharedSecretX: bigint,
    ciphertext: bigint[]
): { amountWei: bigint; amountFormatted: string } {
    if (!ciphertext || ciphertext.length === 0) {
        return { amountWei: BigInt(0), amountFormatted: 'Unknown' };
    }

    // Derive same mask used for encryption
    const prefix = new TextEncoder().encode("stealthflow:metadata");
    const secretBytes = bigIntToBytes(sharedSecretX);
    const combined = new Uint8Array([...prefix, ...secretBytes]);
    const mask = bytesToBigInt(keccak256(combined));

    // XOR to decrypt (since XOR is symmetric)
    const amountWei = ciphertext[0] ^ mask;

    // Format to human readable
    const amountFormatted = formatWeiToToken(amountWei);

    return { amountWei, amountFormatted };
}

/**
 * Compute stealth address from stealth public key
 * Matches logic in StealthSend: truncates to fits Starknet address space
 */
export function computeStealthAddress(stealthPub: Point): string {
    // Note: This logic matches StealthSend.tsx
    // It takes the first 62 hex characters of the X coordinate
    // This effectively truncates the number to ensure it fits in Starknet address field
    return '0x' + stealthPub.x.toString(16).slice(0, 62);
}
