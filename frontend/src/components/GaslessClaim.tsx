'use client';

import { useState, useMemo } from 'react';
import { useAccount } from '@starknet-react/core';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ArrowLeft, Copy, CheckCircle2, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { Point } from '../stealth-crypto';

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
            <Button variant="ghost" onClick={onClose} className="gap-2 mb-4 hover:bg-white/5">
                <ArrowLeft className="w-4 h-4" /> Back to Scanner
            </Button>

            <Card className="border-amber-500/30 bg-black/60 backdrop-blur-xl shadow-2xl shadow-amber-900/10">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-amber-500">
                            <Terminal className="w-5 h-5" />
                            Developer Claim Mode
                        </CardTitle>
                        <Badge variant="outline" className="border-amber-500 text-amber-500 bg-amber-500/10">
                            CLI Required
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Fund Details */}
                    <div className="bg-white/5 p-4 rounded-lg flex justify-between items-center border border-white/10">
                        <span className="text-sm text-muted-foreground">Unclaimed Balance</span>
                        <span className="text-xl font-bold text-green-400">{fund.amount} STRK</span>
                    </div>

                    <div className="space-y-4">
                        {/* Step 1: Recipient */}
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">1. Destination Wallet</label>
                            <Input
                                placeholder="0x..."
                                value={recipientAddress}
                                onChange={(e) => setRecipientAddress(e.target.value)}
                                className="font-mono bg-black/50 border-white/10 focus:border-amber-500/50 transition-colors"
                            />
                        </div>

                        {/* Step 2: Stealth Key */}
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">2. Stealth Private Key</label>
                            <div className="flex gap-2">
                                <Input
                                    value={stealthPrivHex}
                                    readOnly
                                    className="font-mono text-xs flex-1 bg-red-950/10 border-red-500/20 text-red-200/80"
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-500/20 text-red-400 hover:bg-red-950/20"
                                    onClick={() => copyToClipboard(stealthPrivHex, 'Stealth Key')}
                                >
                                    {copied === 'Stealth Key' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>

                        {/* Step 3: Command */}
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">3. Run Command</label>
                            <div className="relative group">
                                <div className="bg-black p-4 rounded-lg border border-amber-500/20 font-mono text-xs text-amber-400 break-all leading-relaxed">
                                    {claimCommand}
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="absolute top-2 right-2 text-amber-500 hover:text-amber-400 hover:bg-amber-950/50 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => copyToClipboard(claimCommand, 'Command')}
                                >
                                    {copied === 'Command' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground pt-1">
                                Requires <code>starknet-py</code> and <code>garaga</code>. See README for setup.
                            </p>
                        </div>
                        
                        {/* Env Vars Reminder */}
                        <div className="bg-blue-500/5 border border-blue-500/10 rounded p-3 text-xs text-blue-200/70">
                            <strong>Tip:</strong> Don't forget to export your <code>SPONSOR_PRIVATE_KEY</code> in the terminal to pay for gas!
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}