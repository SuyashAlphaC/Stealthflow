'use client';

import { useConnect, useDisconnect, useAccount } from '@starknet-react/core';

export function WalletConnect() {
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();
    const { address, isConnected, connector } = useAccount();

    if (isConnected && address) {
        return (
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                    <span className="status-dot success" />
                    <span className="font-mono text-sm text-[var(--foreground)]">
                        {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                </div>
                <button
                    onClick={() => disconnect()}
                    className="btn-secondary text-sm py-2 px-3"
                >
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            {connectors.map((conn) => (
                <button
                    key={conn.id}
                    onClick={() => connect({ connector: conn })}
                    className="btn-primary text-sm py-2"
                >
                    Connect {conn.name}
                </button>
            ))}
        </div>
    );
}
