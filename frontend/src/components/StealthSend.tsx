'use client';

import { useState, useMemo } from 'react';
import {
    generateStealthAddress,
    parseMetaAddress,
    Point,
    formatPoint
} from '../stealth-crypto';

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
    const [metaAddress, setMetaAddress] = useState('');
    const [amount, setAmount] = useState('');
    const [token, setToken] = useState('ETH');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedData, setGeneratedData] = useState<{
        stealthPub: Point;
        ephemeralPub: Point;
        viewTag: number;
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

            setGeneratedData({
                stealthPub: result.stealthPub,
                ephemeralPub: result.ephemeralPub,
                viewTag: result.viewTag
            });

            // Update debugger
            onShowDebugger({
                viewPub: parsedAddress.viewPub,
                spendPub: parsedAddress.spendPub,
                stealthPub: result.stealthPub,
                ephemeralPub: result.ephemeralPub,
                viewTag: result.viewTag
            });

            setIsGenerating(false);
        }, 500);
    };

    const handleSend = async () => {
        if (!generatedData) return;

        // TODO: Implement actual transaction
        console.log('Sending privately...', {
            stealthAddress: generatedData.stealthPub,
            ephemeralPub: generatedData.ephemeralPub,
            viewTag: generatedData.viewTag,
            amount,
            token
        });
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

                    <div className="pt-2 border-t border-[var(--border)]">
                        <button
                            onClick={handleSend}
                            disabled={!amount}
                            className={`w-full btn-primary ${!amount ? 'opacity-50' : ''}`}
                        >
                            🔒 Send Privately
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
