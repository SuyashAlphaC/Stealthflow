'use client';

import { useState } from 'react';
import { Point, formatPoint } from '../stealth-crypto';

interface ClaimStep {
    id: number;
    label: string;
    status: 'pending' | 'active' | 'complete' | 'error';
    detail?: string;
}

interface Props {
    fund: {
        stealthPub: Point;
        stealthPriv: bigint;
        ephemeralPub: Point;
        amount: string;
        token: string;
        txHash: string;
    } | null;
    onClose: () => void;
}

export function GaslessClaim({ fund, onClose }: Props) {
    const [steps, setSteps] = useState<ClaimStep[]>([
        { id: 1, label: 'Generating Garaga Signature', status: 'pending', detail: '42-felt secp256k1 hints' },
        { id: 2, label: 'Deploying Stealth Account', status: 'pending', detail: 'Counterfactual deployment' },
        { id: 3, label: 'Executing Multi-call', status: 'pending', detail: 'Claim + Paymaster reimbursement' },
        { id: 4, label: 'Verifying Completion', status: 'pending', detail: 'Transaction confirmed' },
    ]);
    const [currentStep, setCurrentStep] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const simulateStep = (stepIndex: number): Promise<void> => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // 5% chance of failure for demo
                if (Math.random() < 0.05) {
                    reject(new Error('RPC timeout'));
                } else {
                    resolve();
                }
            }, 1500 + Math.random() * 1000);
        });
    };

    const handleClaim = async () => {
        if (!fund) return;

        setIsProcessing(true);
        setError(null);

        for (let i = 0; i < steps.length; i++) {
            setCurrentStep(i);
            setSteps(prev => prev.map((s, idx) =>
                idx === i ? { ...s, status: 'active' } : s
            ));

            try {
                await simulateStep(i);

                setSteps(prev => prev.map((s, idx) =>
                    idx === i ? { ...s, status: 'complete' } : s
                ));
            } catch (err) {
                setSteps(prev => prev.map((s, idx) =>
                    idx === i ? { ...s, status: 'error' } : s
                ));
                setError(err instanceof Error ? err.message : 'Unknown error');
                setIsProcessing(false);
                return;
            }
        }

        setIsComplete(true);
        setIsProcessing(false);
    };

    if (!fund) {
        return (
            <div className="text-center py-12">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                    No Funds Selected
                </h3>
                <p className="text-[var(--text-secondary)] text-sm">
                    Discover stealth payments in the Scanner tab to claim them here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                    Gasless Claim
                </h2>
                <p className="text-[var(--text-secondary)] text-sm">
                    Claim your stealth funds with one click. Gas paid via {fund.token}.
                </p>
            </div>

            {/* Fund Summary */}
            <div className="card-elevated">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-[var(--text-muted)] uppercase tracking-wide">
                        Claiming
                    </span>
                    <button
                        onClick={onClose}
                        className="text-[var(--text-muted)] hover:text-[var(--foreground)] text-sm"
                    >
                        ✕ Cancel
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-xl">
                        💰
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-[var(--foreground)]">
                            {fund.amount} {fund.token}
                        </div>
                        <div className="font-mono text-xs text-[var(--text-muted)]">
                            {fund.txHash.slice(0, 18)}...{fund.txHash.slice(-10)}
                        </div>
                    </div>
                </div>

                {/* Stealth Address */}
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                        Stealth Address
                    </span>
                    <p className="font-mono text-xs text-[var(--accent-secondary)] mt-1">
                        {formatPoint(fund.stealthPub)}
                    </p>
                </div>
            </div>

            {/* Progress Stepper */}
            <div className="card">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-6">
                    Claim Progress
                </h3>

                <div className="space-y-4">
                    {steps.map((step, idx) => (
                        <div key={step.id} className="stepper-item">
                            <div className={`stepper-circle ${step.status}`}>
                                {step.status === 'complete' ? (
                                    <span>✓</span>
                                ) : step.status === 'active' ? (
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : step.status === 'error' ? (
                                    <span>✕</span>
                                ) : (
                                    step.id
                                )}
                            </div>

                            <div className="flex-1">
                                <div className={`font-medium ${step.status === 'complete' ? 'text-[var(--accent-success)]' :
                                    step.status === 'active' ? 'text-[var(--foreground)]' :
                                        step.status === 'error' ? 'text-[var(--accent-error)]' :
                                            'text-[var(--text-muted)]'
                                    }`}>
                                    {step.label}
                                </div>
                                <div className="text-xs text-[var(--text-muted)]">
                                    {step.detail}
                                </div>
                            </div>

                            {step.status === 'active' && (
                                <div className="text-xs text-[var(--accent-primary)] animate-pulse">
                                    Processing...
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Error display */}
                {error && (
                    <div className="mt-4 p-3 bg-[var(--accent-error)] bg-opacity-10 border border-[var(--accent-error)] rounded-lg">
                        <div className="text-sm text-[var(--accent-error)] font-medium">
                            Transaction Failed
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] mt-1">
                            {error}. Retry to continue.
                        </div>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
                {isComplete ? (
                    <button
                        onClick={onClose}
                        className="flex-1 btn-primary bg-[var(--accent-success)]"
                    >
                        ✓ Claim Complete - Close
                    </button>
                ) : (
                    <>
                        <button
                            onClick={onClose}
                            className="btn-secondary"
                            disabled={isProcessing}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleClaim}
                            disabled={isProcessing}
                            className={`flex-1 btn-primary ${isProcessing ? 'opacity-50' : ''}`}
                        >
                            {isProcessing ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Processing...
                                </span>
                            ) : error ? (
                                '🔄 Retry Claim'
                            ) : (
                                '⚡ One-Click Claim'
                            )}
                        </button>
                    </>
                )}
            </div>

            {/* Technical Details */}
            <div className="text-xs text-[var(--text-muted)] text-center">
                Powered by Garaga secp256k1 verification • 42-felt signature hints
            </div>
        </div>
    );
}
