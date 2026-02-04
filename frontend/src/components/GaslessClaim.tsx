'use client';

import { useState, useMemo } from 'react';
import { useAccount } from '@starknet-react/core';
import { Point, formatPoint } from '../stealth-crypto';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { Loader2, Zap, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { CONTRACTS, computeStealthAccountAddress, getProvider } from '../contracts';

interface SelectedFund {
    stealthPub: Point;
    stealthPriv: bigint;
    ephemeralPub: Point;
    amount: string;
    token: string;
    txHash: string;
}

interface Props {
    fund: SelectedFund | null;
    onClose: () => void;
}

interface ClaimStep {
    id: number;
    label: string;
    status: 'pending' | 'active' | 'complete' | 'error';
    detail?: string;
}

export function GaslessClaim({ fund, onClose }: Props) {
    const { address } = useAccount();
    const [recipientAddress, setRecipientAddress] = useState(address || '');
    const [isClaiming, setIsClaiming] = useState(false);
    const [claimStatus, setClaimStatus] = useState<'idle' | 'generating_proof' | 'submitting' | 'complete' | 'failed'>('idle');
    const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
    const [steps, setSteps] = useState<ClaimStep[]>([
        { id: 1, label: 'Generating Garaga Signature', status: 'pending', detail: '42-felt secp256k1 hints' },
        { id: 2, label: 'Deploying Stealth Account', status: 'pending', detail: 'Counterfactual deployment' },
        { id: 3, label: 'Executing Multi-call', status: 'pending', detail: 'Claim + Paymaster reimbursement' },
        { id: 4, label: 'Verifying Completion', status: 'pending', detail: 'Transaction confirmed' },
    ]);

    // Update recipient address when wallet connects
    useMemo(() => {
        if (address && !recipientAddress) {
            setRecipientAddress(address);
        }
    }, [address, recipientAddress]);

    const handleClaim = async () => {
        if (!fund) return;
        if (!recipientAddress) {
            toast.error("Please enter a recipient address");
            return;
        }

        setIsClaiming(true);
        setClaimStatus('generating_proof');
        const toastId = toast.loading("Starting gasless claim...");

        // Reset steps
        setSteps(prev => prev.map(s => ({ ...s, status: 'pending' })));

        try {
            // Step 1: Generate Proof & Deploy
            setSteps(prev => prev.map(s => s.id === 1 ? { ...s, status: 'active' } : s));
            console.log('[Claim] Initiating claim via backend API...');

            // Call the API endpoint
            const response = await fetch('/api/claim', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    stealthPriv: "0x" + fund.stealthPriv.toString(16),
                    recipient: recipientAddress,
                    amount: fund.amount // Optional, for logging
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Claim failed');
            }

            console.log('[Claim] API Response:', data);

            // Update Steps based on response
            setSteps(prev => prev.map(s => s.id === 1 ? { ...s, status: 'complete' } : s));

            // Step 2: Deploy
            if (data.deployTxHash) {
                setSteps(prev => prev.map(s => s.id === 2 ? { ...s, status: 'complete', detail: 'Deployed: ' + data.deployTxHash.slice(0, 6) } : s));
            } else {
                setSteps(prev => prev.map(s => s.id === 2 ? { ...s, status: 'complete', detail: 'Already Deployed' } : s));
            }

            // Step 3: Execute
            if (data.transferTxHash) {
                setSteps(prev => prev.map(s => s.id === 3 ? { ...s, status: 'complete', detail: 'Transfer: ' + data.transferTxHash.slice(0, 6) } : s));
                setClaimTxHash(data.transferTxHash);
            } else {
                throw new Error("No transfer transaction hash returned");
            }

            // Step 4: Verify
            setSteps(prev => prev.map(s => s.id === 4 ? { ...s, status: 'complete' } : s));
            setClaimStatus('complete');

            toast.success("Funds claimed successfully!", { id: toastId });

        } catch (error: any) {
            console.error('Claim failed:', error);
            setClaimStatus('failed');
            // Find currently active step and mark as error
            setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' } : s));
            toast.error("Claim failed: " + error.message, { id: toastId });
        } finally {
            setIsClaiming(false);
        }
    };

    if (!fund) return null;

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <Button variant="ghost" onClick={onClose} className="gap-2 mb-4">
                <ArrowLeft className="w-4 h-4" /> Back to Scanner
            </Button>

            <Card className="border-green-500/20">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-yellow-500" />
                            Gasless Claim
                        </CardTitle>
                        <Badge variant="success">Ready to Claim</Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Amount</span>
                            <span className="text-xl font-bold">{fund.amount} {fund.token}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Original Sender Tx</span>
                            <span className="font-mono text-xs text-primary truncate max-w-[150px]">
                                {fund.txHash.slice(0, 10)}...
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Destination Wallet Address</label>
                        <Input
                            placeholder="0x..."
                            value={recipientAddress}
                            onChange={(e) => setRecipientAddress(e.target.value)}
                            className="font-mono"
                        />
                        <p className="text-xs text-muted-foreground">
                            The address where you want to receive the funds. It can be a fresh address with 0 ETH!
                        </p>
                    </div>

                    {/* Progress Stepper used when claiming or complete */}
                    {(isClaiming || claimStatus === 'complete' || claimStatus === 'failed') && (
                        <div className="space-y-3 py-4 border-t border-border">
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Claim Progress</h4>
                            {steps.map((step) => (
                                <div key={step.id} className="flex items-start gap-3">
                                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${step.status === 'complete' ? 'bg-green-500 border-green-500 text-white' :
                                        step.status === 'active' ? 'border-primary text-primary' :
                                            step.status === 'error' ? 'bg-red-500 border-red-500 text-white' :
                                                'border-muted text-muted-foreground'
                                        }`}>
                                        {step.status === 'complete' ? <CheckCircle2 className="w-3 h-3" /> :
                                            step.status === 'active' ? <Loader2 className="w-3 h-3 animate-spin" /> :
                                                step.status === 'error' ? '!' : step.id}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`text-sm ${step.status === 'active' ? 'text-primary font-medium' :
                                            step.status === 'complete' ? 'text-green-500' :
                                                step.status === 'error' ? 'text-red-500' :
                                                    'text-muted-foreground'
                                            }`}>
                                            {step.label}
                                        </p>
                                        {(step.detail && step.status !== 'pending') && (
                                            <p className="text-xs text-muted-foreground">{step.detail}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {claimStatus === 'complete' ? (
                        <div className="text-center space-y-2 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
                            <h3 className="font-semibold text-green-500">Claim Successful!</h3>
                            <p className="text-sm text-muted-foreground">Your funds have been transferred.</p>
                            {claimTxHash && (
                                <a
                                    href={`https://sepolia.voyager.online/tx/${claimTxHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline"
                                >
                                    View Transaction on Voyager
                                </a>
                            )}
                        </div>
                    ) : (
                        <Button
                            onClick={handleClaim}
                            disabled={isClaiming || !recipientAddress}
                            className="w-full h-12 text-lg"
                            variant="primary"
                        >
                            {isClaiming ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                "Claim Funds (Gasless)"
                            )}
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
