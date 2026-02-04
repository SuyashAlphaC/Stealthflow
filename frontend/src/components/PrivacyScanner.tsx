'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useContract, useBlock } from '@starknet-react/core';
import {
    checkStealthPayment,
    Point,
    computeStealthPrivKey,
    getPublicKey,
    formatPoint,
    pointMul,
    decryptMetadata,
    computeStealthAddress,
    formatWeiToToken
} from '../stealth-crypto';
import { CONTRACTS, fetchAnnouncements } from '../contracts';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Loader2, Search, Key, Wallet, ArrowRight, Eye, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface SelectedFund {
    stealthPub: Point;
    stealthPriv: bigint;
    ephemeralPub: Point;
    amount: string;
    token: string;
    txHash: string;
}

interface ScanResult {
    stealthPub: Point;
    stealthPriv: bigint;
    ephemeralPub: Point;
    amount: string;
    token: string;
    txHash: string;
}

interface Props {
    onFundDiscovered: (fund: SelectedFund) => void;
}

export function PrivacyScanner({ onFundDiscovered }: Props) {
    const { account } = useAccount();
    const [viewPrivKey, setViewPrivKey] = useState('');
    const [spendPrivKey, setSpendPrivKey] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [foundFunds, setFoundFunds] = useState<ScanResult[]>([]);

    // Get current block
    const { data: block } = useBlock();

    const handleScan = async () => {
        if (!viewPrivKey || !spendPrivKey) {
            toast.error("Please enter both keys");
            return;
        }

        // Validate hex keys
        try {
            if (!viewPrivKey.startsWith('0x') || !spendPrivKey.startsWith('0x')) {
                throw new Error("Keys must start with 0x");
            }
            BigInt(viewPrivKey);
            BigInt(spendPrivKey);
        } catch {
            toast.error("Invalid key format (must be hex)");
            return;
        }

        setIsScanning(true);
        setFoundFunds([]);
        const toastId = toast.loading("Scanning blockchain...");

        try {
            // Use the provider from contracts helper
            // In a production app, we might want to use the connected provider via useProvider()
            // but for scanning past events, a dedicated RPC provider is fine.
            const { getProvider } = require('../contracts'); // Dynamic import to avoid earlier issues if any
            const provider = getProvider('sepolia');

            // Scan last 1000 blocks or from specific block if we knew where to start
            // Defaults to recent history for demo purposes
            const currentBlock = block?.block_number || await provider.getBlockNumber();
            const fromBlock = Math.max(0, currentBlock - 5000); // Scan last 5000 blocks (~2-3 hours)

            console.log(`Scanning from ${fromBlock} to ${currentBlock}`);

            const announcements = await fetchAnnouncements(provider, fromBlock, currentBlock);

            console.log(`Fetched ${announcements.length} announcements`);

            const found: ScanResult[] = [];
            const viewPriv = BigInt(viewPrivKey);
            const spendPriv = BigInt(spendPrivKey);
            // We need spendPub for API but checkStealthPayment doesn't strictly need it for the check itself
            // We can derive it or pass dummy point if needed, but let's derive it to be safe/correct
            const spendPub = getPublicKey(spendPriv);

            for (const event of announcements) {
                // Check if this payment is for us
                const result = checkStealthPayment(
                    viewPriv,
                    spendPub,
                    event.ephemeralPubkey,
                    event.viewTag
                );

                if (result !== null) {
                    console.log('Found match! Tx:', event.txHash);

                    const { sharedSecret, sharedSecretHash } = result;

                    // Decrypt metadata (amount) using shared secret X coordinate
                    const { amountFormatted } = decryptMetadata(sharedSecret.x, event.ciphertext);

                    // Compute stealth private key for claiming using shared secret hash
                    const stealthPriv = computeStealthPrivKey(spendPriv, sharedSecretHash);

                    // Recompute stealth address to confirm/show
                    const stealthPub = getPublicKey(stealthPriv);

                    found.push({
                        stealthPub,
                        stealthPriv,
                        ephemeralPub: event.ephemeralPubkey,
                        amount: amountFormatted,
                        token: 'ETH', // Simplification: assume ETH or check announcements if they included token info
                        txHash: event.txHash
                    });
                }
            }

            if (found.length > 0) {
                setFoundFunds(found);
                toast.success(`Found ${found.length} private transactions!`, { id: toastId });
            } else {
                toast.info("No funds found in recent blocks", { id: toastId });
            }

        } catch (error: any) {
            console.error('Scan failed:', error);
            toast.error("Scan failed: " + error.message, { id: toastId });
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Privacy Scanner</h2>
                <p className="text-muted-foreground">
                    Scan the blockchain for funds sent to your stealth addresses.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="w-5 h-5" />
                        Scanner Keys
                    </CardTitle>
                    <CardDescription>
                        Enter your private keys to decrypt announcements.
                        <span className="text-yellow-500 flex items-center gap-1 mt-1 text-xs">
                            <AlertCircle className="w-3 h-3" /> Never share these keys!
                        </span>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">View Private Key (Hex)</label>
                        <Input
                            type="password"
                            placeholder="0x..."
                            value={viewPrivKey}
                            onChange={(e) => setViewPrivKey(e.target.value)}
                            className="font-mono"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Spend Private Key (Hex)</label>
                        <Input
                            type="password"
                            placeholder="0x..."
                            value={spendPrivKey}
                            onChange={(e) => setSpendPrivKey(e.target.value)}
                            className="font-mono"
                        />
                    </div>

                    <Button
                        onClick={handleScan}
                        disabled={isScanning || !viewPrivKey || !spendPrivKey}
                        className="w-full"
                    >
                        {isScanning ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Scanning...
                            </>
                        ) : (
                            <>
                                <Search className="mr-2 h-4 w-4" />
                                Start Privacy Scan
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {foundFunds.length > 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-green-500" />
                        Discovered Private Funds
                    </h3>

                    <div className="grid gap-4">
                        {foundFunds.map((fund, index) => (
                            <Card key={index} className="overflow-hidden border-l-4 border-l-green-500">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl font-bold">{fund.amount}</span>
                                                <Badge variant="secondary">{fund.token}</Badge>
                                            </div>
                                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                <Eye className="w-3 h-3" />
                                                Stealth Address: <span className="font-mono text-xs">{formatPoint(fund.stealthPub).slice(0, 10)}...</span>
                                            </div>
                                        </div>

                                        <Button
                                            size="sm"
                                            onClick={() => onFundDiscovered(fund)}
                                            className="gap-2"
                                            variant="outline"
                                        >
                                            Claim <ArrowRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}