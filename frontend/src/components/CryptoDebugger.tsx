'use client';

import { Point, formatPoint } from '../stealth-crypto';
import { DebugData } from './StealthSend';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    data: DebugData;
}

export function CryptoDebugger({ isOpen, onClose, data }: Props) {
    if (!isOpen) return null;

    const renderPoint = (label: string, point?: Point, color: string = 'var(--accent-primary)') => {
        if (!point) return null;
        return (
            <div className="space-y-1">
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                    {label}
                </div>
                <div className="font-mono text-xs break-all" style={{ color }}>
                    <div>x: 0x{point.x.toString(16)}</div>
                    <div className="mt-1">y: 0x{point.y.toString(16)}</div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative glass rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-[var(--accent-secondary)] bg-opacity-20 flex items-center justify-center text-[var(--accent-secondary)]">
                            🔬
                        </div>
                        <div>
                            <h3 className="font-semibold text-[var(--foreground)]">
                                Cryptography Debugger
                            </h3>
                            <p className="text-xs text-[var(--text-muted)]">
                                secp256k1 stealth address derivation proof
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded hover:bg-[var(--surface)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--foreground)]"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(80vh-100px)]">
                    {/* Formula */}
                    <div className="card bg-[var(--background)]">
                        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                            Stealth Address Formula
                        </div>
                        <div className="font-mono text-sm text-[var(--foreground)]">
                            P = Spend_Pub + Keccak256(r × View_Pub) × G
                        </div>
                        <div className="mt-2 text-xs text-[var(--text-secondary)]">
                            Where r is the ephemeral private key, G is the generator point
                        </div>
                    </div>

                    {/* Input Keys */}
                    <div>
                        <h4 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
                            Input Keys (Recipient's Meta-Address)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="card-elevated">
                                {renderPoint('View Public Key (V)', data.viewPub, 'var(--accent-secondary)')}
                            </div>
                            <div className="card-elevated">
                                {renderPoint('Spend Public Key (S)', data.spendPub, 'var(--accent-secondary)')}
                            </div>
                        </div>
                    </div>

                    {/* Derived Values */}
                    <div>
                        <h4 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
                            Derived Cryptographic Values
                        </h4>
                        <div className="space-y-4">
                            <div className="card-elevated">
                                {renderPoint('Ephemeral Public Key (R = r × G)', data.ephemeralPub, 'var(--accent-primary)')}
                            </div>

                            {data.sharedSecretX && (
                                <div className="card-elevated">
                                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">
                                        Shared Secret S.x (r × V)
                                    </div>
                                    <div className="font-mono text-xs text-[var(--accent-primary)] break-all">
                                        0x{data.sharedSecretX.toString(16)}
                                    </div>
                                </div>
                            )}

                            <div className="card-elevated">
                                {renderPoint('Stealth Public Key (P)', data.stealthPub, 'var(--accent-success)')}
                            </div>
                        </div>
                    </div>

                    {/* View Tag */}
                    {data.viewTag !== undefined && (
                        <div>
                            <h4 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
                                View Tag Derivation
                            </h4>
                            <div className="card-elevated flex items-center gap-4">
                                <div className="view-tag text-lg py-1 px-3">
                                    0x{data.viewTag.toString(16).padStart(2, '0').toUpperCase()}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-[var(--foreground)]">
                                        = Keccak256(S.x)[0]
                                    </div>
                                    <div className="text-xs text-[var(--text-muted)]">
                                        First byte of hash, enables 255/256 fast filtering
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Efficiency Stats */}
                    <div className="card bg-[var(--background)]">
                        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-3">
                            Privacy Efficiency
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="font-mono text-xl font-bold text-[var(--accent-success)]">
                                    99.6%
                                </div>
                                <div className="text-xs text-[var(--text-muted)]">
                                    Filter Rate
                                </div>
                            </div>
                            <div>
                                <div className="font-mono text-xl font-bold text-[var(--accent-primary)]">
                                    1 byte
                                </div>
                                <div className="text-xs text-[var(--text-muted)]">
                                    View Tag Size
                                </div>
                            </div>
                            <div>
                                <div className="font-mono text-xl font-bold text-[var(--accent-secondary)]">
                                    42 felts
                                </div>
                                <div className="text-xs text-[var(--text-muted)]">
                                    Garaga Signature
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
