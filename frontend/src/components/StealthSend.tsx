'use client';

import { useState, useMemo } from 'react';
import { useAccount } from '@starknet-react/core';
import {
    generateStealthAddress,
    parseMetaAddress,
    Point,
    formatPoint,
    pointMul,
    encryptMetadata,
    parseTokenToWei
} from '../stealth-crypto';
import { CONTRACTS, computeStealthAccountAddress } from '../contracts';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { Loader2, Lock, ArrowRight, ExternalLink, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

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
    const { account } = useAccount();
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
            toast.success("Stealth address generated successfully");
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
        if (!generatedData || !account || !amount) {
            toast.error("Please fill in all fields and connect wallet");
            return;
        }

        setIsSending(true);
        setTxHash(null);
        const toastId = toast.loading("Sending private transaction...");

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
            toast.success("Transaction sent successfully!", { id: toastId });
            console.log('Transaction sent:', result.transaction_hash);
        } catch (error: any) {
            console.error('Transaction failed:', error);
            toast.error("Transaction failed: " + (error.message || "Unknown error"), { id: toastId });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Stealth Send</h2>
                <p className="text-muted-foreground">
                    Send funds privately. Only the recipient with the correct key can see and claim.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recipient Details</CardTitle>
                    <CardDescription>Enter the recipient's meta-address and amount</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">
                            Recipient Meta-Address
                        </label>
                        <div className="relative">
                            <textarea
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono resize-none"
                                placeholder="st:starknet:0xVIEW_X,VIEW_Y,SPEND_X,SPEND_Y"
                                value={metaAddress}
                                onChange={(e) => {
                                    setMetaAddress(e.target.value);
                                    setGeneratedData(null);
                                }}
                            />
                            {metaAddress && (
                                <div className="absolute top-2 right-2">
                                    {parsedAddress ? (
                                        <Badge variant="success" className="gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> Valid
                                        </Badge>
                                    ) : (
                                        <Badge variant="destructive">Invalid</Badge>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Amount</label>
                            <Input
                                type="text"
                                placeholder="0.0"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Token</label>
                            <select
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                            >
                                <option value="STRK">Native STRK</option>
                            </select>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    {!generatedData && (
                        <Button
                            onClick={handleGenerate}
                            disabled={!parsedAddress || isGenerating}
                            className="w-full"
                            variant="secondary"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deriving...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Generate Stealth Address
                                </>
                            )}
                        </Button>
                    )}
                </CardFooter>
            </Card>

            {generatedData && (
                <Card className="border-primary/50 relative overflow-hidden">
                    <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Lock className="w-5 h-5 text-primary" />
                                Privacy Preview
                            </CardTitle>
                            <Badge variant="outline" className="font-mono">
                                View Tag: 0x{generatedData.viewTag.toString(16).padStart(2, '0').toUpperCase()}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                Stealth Address
                            </span>
                            <div className="p-2 rounded bg-muted/50 font-mono text-xs break-all text-primary">
                                {formatPoint(generatedData.stealthPub)}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                Ephemeral Key
                            </span>
                            <div className="p-2 rounded bg-muted/50 font-mono text-xs break-all">
                                {formatPoint(generatedData.ephemeralPub)}
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex-col gap-4">
                        {!account ? (
                            <Button disabled className="w-full" variant="outline">
                                Connect Wallet to Send
                            </Button>
                        ) : (
                            <Button
                                onClick={handleSend}
                                disabled={!amount || isSending}
                                className="w-full"
                                size="lg"
                            >
                                {isSending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        Send Privately <ArrowRight className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        )}

                        {txHash && (
                            <div className="flex flex-col items-center gap-2 w-full pt-2">
                                <div className="flex items-center gap-2 text-green-500 font-medium">
                                    <CheckCircle2 className="w-4 h-4" /> Transaction Sent
                                </div>
                                <a
                                    href={`https://sepolia.voyager.online/tx/${txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                    View on Starkscan <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        )}
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}
