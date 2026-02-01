'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    checkStealthPayment,
    Point,
    generateKeypair,
    computeStealthPrivKey,
    getPublicKey,
    formatPoint
} from '../stealth-crypto';

interface ScanEntry {
    id: string;
    timestamp: Date;
    viewTag: number;
    ephemeralPub: Point;
    isMatch: boolean;
    schemeId: number;
    txHash: string;
    blockNumber: number;
}

interface DiscoveredFund {
    stealthPub: Point;
    stealthPriv: bigint;
    ephemeralPub: Point;
    amount: string;
    token: string;
    txHash: string;
}

interface Props {
    onFundDiscovered: (fund: DiscoveredFund) => void;
}

export function PrivacyScanner({ onFundDiscovered }: Props) {
    const [isScanning, setIsScanning] = useState(false);
    const [scanLog, setScanLog] = useState<ScanEntry[]>([]);
    const [discoveredFunds, setDiscoveredFunds] = useState<DiscoveredFund[]>([]);
    const [viewPriv, setViewPriv] = useState<bigint | null>(null);
    const [spendPub, setSpendPub] = useState<Point | null>(null);
    const [spendPriv, setSpendPriv] = useState<bigint | null>(null);
    const [scanStats, setScanStats] = useState({ total: 0, filtered: 0, matches: 0 });

    // Demo: Generate keys on mount
    useEffect(() => {
        const viewKey = generateKeypair();
        const spendKey = generateKeypair();
        setViewPriv(viewKey.privateKey);
        setSpendPub(spendKey.publicKey);
        setSpendPriv(spendKey.privateKey);
    }, []);

    // Simulate scanning announcements
    const simulateScan = useCallback(() => {
        if (!viewPriv || !spendPub || !spendPriv) return;

        // Generate a mock announcement
        const mockEphemeralPub = generateKeypair().publicKey;
        const mockViewTag = Math.floor(Math.random() * 256);
        const mockSchemeId = 1;
        const mockTxHash = '0x' + Array(64).fill(0).map(() =>
            Math.floor(Math.random() * 16).toString(16)
        ).join('');

        const entry: ScanEntry = {
            id: Date.now().toString(),
            timestamp: new Date(),
            viewTag: mockViewTag,
            ephemeralPub: mockEphemeralPub,
            isMatch: false,
            schemeId: mockSchemeId,
            txHash: mockTxHash,
            blockNumber: Math.floor(Math.random() * 1000000) + 500000
        };

        // Check if this matches our viewing key
        const result = checkStealthPayment(
            viewPriv,
            spendPub,
            mockEphemeralPub,
            mockViewTag
        );

        if (result !== null) {
            entry.isMatch = true;

            // Derive stealth private key
            const stealthPriv = computeStealthPrivKey(spendPriv, result);
            const stealthPub = getPublicKey(stealthPriv);

            const fund: DiscoveredFund = {
                stealthPub,
                stealthPriv,
                ephemeralPub: mockEphemeralPub,
                amount: (Math.random() * 10).toFixed(4),
                token: ['ETH', 'STRK', 'USDC'][Math.floor(Math.random() * 3)],
                txHash: mockTxHash
            };

            setDiscoveredFunds(prev => [...prev, fund]);
            onFundDiscovered(fund);

            setScanStats(prev => ({
                ...prev,
                total: prev.total + 1,
                matches: prev.matches + 1
            }));
        } else {
            setScanStats(prev => ({
                ...prev,
                total: prev.total + 1,
                filtered: prev.filtered + 1
            }));
        }

        setScanLog(prev => [entry, ...prev].slice(0, 50));
    }, [viewPriv, spendPub, spendPriv, onFundDiscovered]);

    // Auto-scan interval
    useEffect(() => {
        if (!isScanning) return;

        const interval = setInterval(simulateScan, 800);
        return () => clearInterval(interval);
    }, [isScanning, simulateScan]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-[var(--foreground)] mb-1">
                        Privacy Scanner
                    </h2>
                    <p className="text-[var(--text-secondary)] text-sm">
                        Real-time scanning for stealth payments using 1-byte View Tags
                    </p>
                </div>
                <button
                    onClick={() => setIsScanning(!isScanning)}
                    className={isScanning ? 'btn-secondary' : 'btn-primary'}
                >
                    {isScanning ? (
                        <span className="flex items-center gap-2">
                            <span className="status-dot warning animate-pulse" />
                            Pause
                        </span>
                    ) : (
                        <span className="flex items-center gap-2">
                            <span className="status-dot success" />
                            Start Scanning
                        </span>
                    )}
                </button>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-4">
                <div className="card text-center">
                    <div className="font-mono text-2xl font-bold text-[var(--foreground)]">
                        {scanStats.total}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mt-1">
                        Announcements
                    </div>
                </div>
                <div className="card text-center">
                    <div className="font-mono text-2xl font-bold text-[var(--accent-secondary)]">
                        {scanStats.filtered}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mt-1">
                        Filtered (Fast)
                    </div>
                </div>
                <div className="card text-center">
                    <div className="font-mono text-2xl font-bold text-[var(--accent-success)]">
                        {scanStats.matches}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mt-1">
                        Matches Found
                    </div>
                </div>
            </div>

            {/* Discovered Funds */}
            {discoveredFunds.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-[var(--accent-success)] uppercase tracking-wide">
                        🎉 Secret Balances Found
                    </h3>
                    {discoveredFunds.map((fund, i) => (
                        <div
                            key={i}
                            className="card-elevated border-[var(--accent-success)] border-opacity-50 flex items-center justify-between animate-fade-in glow-secondary"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-[var(--accent-success)] bg-opacity-20 flex items-center justify-center">
                                    <span className="text-lg">💰</span>
                                </div>
                                <div>
                                    <div className="font-semibold text-[var(--foreground)]">
                                        {fund.amount} {fund.token}
                                    </div>
                                    <div className="text-xs font-mono text-[var(--text-muted)]">
                                        {fund.txHash.slice(0, 10)}...{fund.txHash.slice(-8)}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => onFundDiscovered(fund)}
                                className="btn-primary text-sm"
                            >
                                Claim Now →
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Scan Terminal */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                        Scan Log
                    </h3>
                    <div className="flex items-center gap-2">
                        {isScanning && (
                            <span className="flex items-center gap-1.5 text-xs text-[var(--accent-primary)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
                                Live
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-[var(--background)] rounded-lg p-3 h-[240px] overflow-y-auto font-mono text-xs space-y-1.5">
                    {scanLog.length === 0 ? (
                        <div className="text-[var(--text-muted)] text-center py-8">
                            Start scanning to see announcements...
                        </div>
                    ) : (
                        scanLog.map((entry) => (
                            <div
                                key={entry.id}
                                className={`flex items-center gap-2 py-1 px-2 rounded ${entry.isMatch
                                    ? 'bg-[var(--accent-success)] bg-opacity-10 text-[var(--accent-success)]'
                                    : 'text-[var(--text-muted)]'
                                    }`}
                            >
                                <span className="text-[var(--text-muted)]">
                                    {entry.timestamp.toLocaleTimeString()}
                                </span>
                                <span className="view-tag text-[10px] py-0.5">
                                    0x{entry.viewTag.toString(16).padStart(2, '0').toUpperCase()}
                                </span>
                                <span className="flex-1 truncate">
                                    {entry.txHash.slice(0, 18)}...
                                </span>
                                {entry.isMatch ? (
                                    <span className="text-[var(--accent-success)] font-semibold">
                                        ✓ MATCH
                                    </span>
                                ) : (
                                    <span className="text-[var(--text-muted)]">
                                        filtered
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
