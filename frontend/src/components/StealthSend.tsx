'use client';

import { useState, useMemo } from 'react';
import { useAccount, useContract, useSendTransaction } from '@starknet-react/core';
import { Contract } from 'starknet';
import {
    generateStealthAddress,
    parseMetaAddress,
    Point,
    formatPoint,
    pointMul,
    encryptMetadata,
    parseTokenToWei
} from '../stealth-crypto';
import { CONTRACTS, STEALTH_ANNOUNCER_ABI, computeStealthAccountAddress } from '../contracts';

interface Props {
    onShowDebugger: (data: DebugData) => void;
}

export interface DebugData {
    viewPub?: Point;
    spendPub?: Point;
    stealthPub?: Point;
    ephemeralPub?: Point;
    viewTag?: number;
    sharedSecretX?: bigint;
}

export function StealthSend({ onShowDebugger }: Props) {
    const { account, address } = useAccount();
    const [metaAddress, setMetaAddress] = useState('');
    const [amount, setAmount] = useState('');
    const [token, setToken] = useState('STRK');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [generatedData, setGeneratedData] = useState<{
        stealthPub: Point;
        ephemeralPub: Point;
        viewTag: number;
        sharedSecretX: bigint;
        ephemeralPriv: bigint;
    } | null>(null);

    const parsedAddress = useMemo(() => {
        if (!metaAddress) return null;
        return parseMetaAddress(metaAddress);
    }, [metaAddress]);

    const handleGenerate = () => {
        if (!parsedAddress) return;

        setIsGenerating(true);

        // Simulate async operation
        setTimeout(() => {
            const result = generateStealthAddress(
                parsedAddress.viewPub,
                parsedAddress.spendPub
            );

            // Compute shared secret for metadata encryption
            // S = ephemeralPriv * viewPub
            const sharedSecret = pointMul(result.ephemeralPriv, parsedAddress.viewPub);

            setGeneratedData({
                stealthPub: result.stealthPub,
                ephemeralPub: result.ephemeralPub,
                viewTag: result.viewTag,
                sharedSecretX: sharedSecret.x,
                ephemeralPriv: result.ephemeralPriv
            });

            // Update debugger
            onShowDebugger({
                viewPub: parsedAddress.viewPub,
                spendPub: parsedAddress.spendPub,
                stealthPub: result.stealthPub,
                ephemeralPub: result.ephemeralPub,
                viewTag: result.viewTag,
                sharedSecretX: sharedSecret.x
            });

            setIsGenerating(false);
        }, 500);
    };

    // Helper to split bigint into u256 (low, high) for Starknet
    const splitU256 = (value: bigint): [string, string] => {
        const mask = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
        const low = (value & mask).toString();
        const high = (value >> BigInt(128)).toString();
        return [low, high];
    };

    const handleSend = async () => {
        if (!generatedData || !account || !amount) return;

        setIsSending(true);
        setTxHash(null);

        try {
            // Split ephemeral pubkey into u256 (low, high) pairs
            const [ephXLow, ephXHigh] = splitU256(generatedData.ephemeralPub.x);
            const [ephYLow, ephYHigh] = splitU256(generatedData.ephemeralPub.y);

            // Get token address
            const tokenAddress = token === 'STRK' ? CONTRACTS.STRK : CONTRACTS.ETH;

            // Convert amount to wei (18 decimals) using precise parsing
            const amountWei = parseTokenToWei(amount);
            const [amountLow, amountHigh] = splitU256(amountWei);

            // Encrypt the amount using shared secret
            const encryptedAmounts = encryptMetadata(generatedData.sharedSecretX, amountWei);
            const [cipherLow, cipherHigh] = splitU256(encryptedAmounts[0]);

            // Compute stealth contract address (Deterministic Starknet Address)
            // This ensures we can deploy the account later to claim funds
            const stealthAddressHex = computeStealthAccountAddress(generatedData.stealthPub);

            // Execute multicall: transfer + announce
            const result = await account.execute([
                // 1. Transfer tokens to stealth address
                {
                    contractAddress: tokenAddress,
                    entrypoint: 'transfer',
                    calldata: [stealthAddressHex, amountLow, amountHigh]
                },
                // 2. Announce the payment with encrypted metadata
                {
                    contractAddress: CONTRACTS.STEALTH_ANNOUNCER,
                    entrypoint: 'announce',
                    calldata: [
                        '1', '0', // scheme_id u256 (low, high)
                        '2', // ephemeral_pubkey array length (2 u256 elements)
                        ephXLow, ephXHigh, // ephemeral_x as u256
                        ephYLow, ephYHigh, // ephemeral_y as u256
                        '1', // ciphertext array length (1 encrypted u256)
                        cipherLow, cipherHigh, // encrypted amount as u256
                        generatedData.viewTag.toString()
                    ]
                }
            ]);

            setTxHash(result.transaction_hash);
            console.log('Transaction sent:', result.transaction_hash);
        } catch (error) {
            console.error('Transaction failed:', error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                    Stealth Send
                </h2>
                <p className="text-[var(--text-secondary)] text-sm">
                    Send funds privately using stealth addresses. Only the recipient can claim.
                </p>
            </div>

            {/* Meta Address Input */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--text-secondary)]">
                    Recipient Meta-Address
                </label>
                <textarea
                    className="input min-h-[80px] font-mono text-xs resize-none"
                    placeholder="st:starknet:0xVIEW_X,VIEW_Y,SPEND_X,SPEND_Y"
                    value={metaAddress}
                    onChange={(e) => {
                        setMetaAddress(e.target.value);
                        setGeneratedData(null);
                    }}
                />
                {metaAddress && !parsedAddress && (
                    <p className="text-xs text-[var(--accent-error)]">
                        Invalid meta-address format
                    </p>
                )}
                {parsedAddress && (
                    <p className="text-xs text-[var(--accent-success)]">
                        ✓ Valid meta-address parsed
                    </p>
                )}
            </div>

            {/* Amount & Token */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text-secondary)]">
                        Amount
                    </label>
                    <input
                        type="text"
                        className="input"
                        placeholder="0.0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text-secondary)]">
                        Token
                    </label>
                    <select
                        className="input cursor-pointer"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                    >
                        <option value="ETH">ETH</option>
                        <option value="STRK">STRK</option>
                        <option value="USDC">USDC</option>
                    </select>
                </div>
            </div>

            {/* Generate Button */}
            {!generatedData && (
                <button
                    onClick={handleGenerate}
                    disabled={!parsedAddress || isGenerating}
                    className={`w-full btn-secondary ${!parsedAddress ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                >
                    {isGenerating ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                            Deriving Stealth Address...
                        </span>
                    ) : (
                        'Generate Stealth Address'
                    )}
                </button>
            )}

            {/* Privacy Preview */}
            {generatedData && (
                <div className="card-elevated space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-[var(--foreground)]">
                            Privacy Preview
                        </h3>
                        <div className="view-tag">
                            View Tag: 0x{generatedData.viewTag.toString(16).padStart(2, '0').toUpperCase()}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-1">
                            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                                Stealth Address
                            </span>
                            <p className="font-mono text-xs text-[var(--accent-primary)] break-all">
                                {formatPoint(generatedData.stealthPub)}
                            </p>
                        </div>

                        <div className="space-y-1">
                            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                                Ephemeral Key
                            </span>
                            <p className="font-mono text-xs text-[var(--text-secondary)] break-all">
                                {formatPoint(generatedData.ephemeralPub)}
                            </p>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-[var(--border)] space-y-3">
                        {!account ? (
                            <p className="text-sm text-[var(--text-muted)] text-center">
                                Connect wallet to send
                            </p>
                        ) : (
                            <button
                                onClick={handleSend}
                                disabled={!amount || isSending}
                                className={`w-full btn-primary ${!amount || isSending ? 'opacity-50' : ''}`}
                            >
                                {isSending ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Sending...
                                    </span>
                                ) : (
                                    '🔒 Send Privately'
                                )}
                            </button>
                        )}

                        {txHash && (
                            <div className="text-center">
                                <p className="text-sm text-[var(--accent-success)] mb-1">✓ Transaction sent!</p>
                                <a
                                    href={`https://sepolia.starkscan.co/tx/${txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-[var(--accent-primary)] hover:underline"
                                >
                                    View on Starkscan →
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
