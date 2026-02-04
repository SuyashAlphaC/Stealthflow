'use client';

import { Point } from '../stealth-crypto';
import { DebugData } from './StealthSend';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Bug, X } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    data: DebugData;
}

export function CryptoDebugger({ isOpen, onClose, data }: Props) {
    if (!isOpen) return null;

    const renderPoint = (label: string, point?: Point, colorClass: string = 'text-primary') => {
        if (!point) return null;
        return (
            <div className="space-y-1 p-3 rounded-lg border bg-muted/20">
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                    {label}
                </div>
                <div className={`font-mono text-xs break-all ${colorClass}`}>
                    <div>x: 0x{point.x.toString(16)}</div>
                    <div className="mt-1">y: 0x{point.y.toString(16)}</div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <Card className="relative w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden glass-card">
                <CardHeader className="border-b bg-muted/40 pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-md bg-purple-500/20 text-purple-500">
                                <Bug className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle>Cryptography Debugger</CardTitle>
                                <CardDescription>secp256k1 stealth address derivation prof</CardDescription>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    {/* Formula */}
                    <div className="bg-secondary/50 p-4 rounded-lg border border-border">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-semibold">
                            Stealth Address Formula
                        </div>
                        <div className="font-mono text-sm">
                            P = Spend_Pub + Keccak256(r × View_Pub) × G
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                            Where <span className="text-primary">r</span> is the ephemeral private key, <span className="text-primary">G</span> is the generator point
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {/* Input Keys */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                Input Keys (Recipient Meta-Address)
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {renderPoint('View Public Key (V)', data.viewPub, 'text-blue-500')}
                                {renderPoint('Spend Public Key (S)', data.spendPub, 'text-blue-500')}
                            </div>
                        </div>

                        {/* Derived Values */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-500" />
                                Derived Cryptographic Values
                            </h4>
                            <div className="grid grid-cols-1 gap-4">
                                {renderPoint('Ephemeral Public Key (R = r × G)', data.ephemeralPub, 'text-purple-500')}

                                {data.sharedSecretX && (
                                    <div className="space-y-1 p-3 rounded-lg border bg-muted/20">
                                        <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                                            Shared Secret S.x (r × V)
                                        </div>
                                        <div className="font-mono text-xs break-all text-purple-500">
                                            0x{data.sharedSecretX.toString(16)}
                                        </div>
                                    </div>
                                )}

                                {renderPoint('Stealth Public Key (P)', data.stealthPub, 'text-green-500 font-bold')}
                            </div>
                        </div>

                        {/* View Tag */}
                        {data.viewTag !== undefined && (
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                                    View Tag Derivation
                                </h4>
                                <div className="p-4 rounded-lg border bg-orange-500/10 border-orange-500/20 flex items-center gap-4">
                                    <Badge variant="outline" className="text-lg py-1 px-3 bg-orange-500/20 border-orange-500/30 text-orange-500 font-mono">
                                        0x{data.viewTag.toString(16).padStart(2, '0').toUpperCase()}
                                    </Badge>
                                    <div>
                                        <div className="text-sm font-medium">
                                            = Keccak256(S.x)[0]
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            First byte of hash, enables 255/256 fast filtering
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
