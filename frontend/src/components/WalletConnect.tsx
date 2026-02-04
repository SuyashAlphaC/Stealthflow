'use client';

import { useConnect, useDisconnect, useAccount } from '@starknet-react/core';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Wallet, LogOut, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function WalletConnect() {
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();
    const { address, isConnected, isConnecting } = useAccount();

    const handleConnect = async (connector: any) => {
        try {
            await connect({ connector });
        } catch (e: any) {
            toast.error("Connection failed: " + e.message);
        }
    };

    if (isConnected && address) {
        return (
            <div className="flex items-center gap-2">
                <Badge variant="outline" className="h-9 px-3 gap-2 bg-background">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="font-mono text-xs">
                        {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                </Badge>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => disconnect()}
                    title="Disconnect"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                >
                    <LogOut className="w-4 h-4" />
                </Button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            {connectors.map((conn) => {
                // Simplified connector check
                const isBraavos = conn.id === 'braavos';
                const isArgent = conn.id === 'argentX';

                return (
                    <Button
                        key={conn.id}
                        onClick={() => handleConnect(conn)}
                        variant="secondary"
                        size="sm"
                        disabled={isConnecting}
                        className="gap-2"
                    >
                        {isBraavos ? (
                            <img src="braavos_logo.png" alt="Braavos" className="w-4 h-4" />
                        ) : isArgent ? (
                            <img src="argent_logo.png" alt="Argent" className="w-4 h-4" />
                        ) : (
                            <Wallet className="w-4 h-4" />
                        )}

                        {isConnecting ? '...' : `Connect ${conn.name}`}
                    </Button>
                );
            })}
        </div>
    );
}
