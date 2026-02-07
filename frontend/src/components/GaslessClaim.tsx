'use client';

import { useState, useMemo } from 'react';
import { useAccount } from '@starknet-react/core';
import { Point, formatPoint } from '../stealth-crypto';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { ArrowLeft, Copy, CheckCircle2, Terminal, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

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

export function GaslessClaim({ fund, onClose }: Props) {
    const { address } = useAccount();
    const [recipientAddress, setRecipientAddress] = useState(address || '');
    const [copied, setCopied] = useState<string | null>(null);

    // Update recipient address when wallet connects
    useMemo(() => {
        if (address && !recipientAddress) {
            setRecipientAddress(address);
        }
    }, [address, recipientAddress]);

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopied(label);
        toast.success(`${label} copied to clipboard!`);
        setTimeout(() => setCopied(null), 2000);
    };

    if (!fund) return null;

    const stealthPrivHex = "0x" + fund.stealthPriv.toString(16);
    const claimCommand = `python3 scripts/gasless_claim.py --stealth-priv ${stealthPrivHex} --to ${recipientAddress || '<YOUR_WALLET_ADDRESS>'}`;

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <Button variant="ghost" onClick={onClose} className="gap-2 mb-4">
                <ArrowLeft className="w-4 h-4" /> Back to Scanner
            </Button>

            <Card className="border-yellow-500/20">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Terminal className="w-5 h-5 text-yellow-500" />
                            Manual Claim Required
                        </CardTitle>
                        <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                            Ready to Claim
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Fund Details */}
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

                    {/* Instructions */}
                    <div className="space-y-4">
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                            <h4 className="font-semibold text-blue-400 mb-2">📋 How to Claim</h4>
                            <p className="text-sm text-muted-foreground">
                                To claim your funds, run the Python script manually on your terminal.
                                This ensures maximum security as your private key never leaves your device.
                            </p>
                        </div>

                        {/* Step 1: Set Recipient */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Step 1: Set Destination Wallet</label>
                            <Input
                                placeholder="0x..."
                                value={recipientAddress}
                                onChange={(e) => setRecipientAddress(e.target.value)}
                                className="font-mono"
                            />
                            <p className="text-xs text-muted-foreground">
                                Enter your wallet address where you want to receive the funds.
                            </p>
                        </div>

                        {/* Step 2: Stealth Private Key */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Step 2: Your Stealth Private Key</label>
                            <div className="flex gap-2">
                                <Input
                                    value={stealthPrivHex}
                                    readOnly
                                    className="font-mono text-xs flex-1"
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyToClipboard(stealthPrivHex, 'Stealth Key')}
                                >
                                    {copied === 'Stealth Key' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                ⚠️ Keep this private! This key is used to prove ownership of the stealth address.
                            </p>
                        </div>

                        {/* Step 3: Run Command */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Step 3: Run the Claim Command</label>
                            <div className="bg-black/50 rounded-lg p-3 border border-border">
                                <div className="flex items-start justify-between gap-2">
                                    <code className="text-xs text-green-400 break-all flex-1">
                                        {claimCommand}
                                    </code>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="shrink-0"
                                        onClick={() => copyToClipboard(claimCommand, 'Command')}
                                    >
                                        {copied === 'Command' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Run this command in the StealthFlow project directory.
                                Make sure you have Python 3 and required dependencies installed.
                            </p>
                        </div>

                        {/* Environment Variables Note */}
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                            <h4 className="font-semibold text-yellow-400 mb-2">⚠️ Required Environment Variables</h4>
                            <div className="space-y-1 font-mono text-xs text-muted-foreground">
                                <p>export SPONSOR_ADDRESS=0x...</p>
                                <p>export SPONSOR_PRIVATE_KEY=0x...</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                The sponsor account pays gas fees. Contact the sender or service provider for these values.
                            </p>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <a
                        href="https://github.com/your-repo/stealthflow#claiming-funds"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                        <ExternalLink className="w-3 h-3" />
                        View Documentation
                    </a>
                </CardFooter>
            </Card>
        </div>
    );
}
