'use client';

import { ReactNode } from 'react';
import { sepolia, mainnet } from '@starknet-react/chains';
import { StarknetConfig, jsonRpcProvider, argent, braavos } from '@starknet-react/core';

const chains = [sepolia, mainnet];
const connectors = [argent(), braavos()];

function rpc(chain: any) {
    return {
        nodeUrl: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/LfKXerIDAvp3ToDzzjfD8'
    }
}

export function StarknetProvider({ children }: { children: ReactNode }) {
    return (
        <StarknetConfig
            chains={chains}
            provider={jsonRpcProvider({ rpc })}
            connectors={connectors}
            autoConnect
        >
            {children}
        </StarknetConfig>
    );
}
