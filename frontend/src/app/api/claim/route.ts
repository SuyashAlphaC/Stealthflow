
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { stealthPriv, recipient, amount } = body;

        if (!stealthPriv || !recipient) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // Path to gasless claim script
        const scriptPath = path.resolve(process.cwd(), '../scripts/gasless_claim.py');

        // Command - gasless_claim.py handles sponsor-based deployment
        const command = `python3 "${scriptPath}" --stealth-priv ${stealthPriv} --to ${recipient}`;

        console.log('[API] Executing gasless claim script:', command);

        return new Promise<NextResponse>((resolve) => {
            exec(command, {
                timeout: 120000, // 2 minute timeout
                env: {
                    ...process.env,
                    // Sponsor account env vars should be set in .env.local
                    SPONSOR_ADDRESS: process.env.SPONSOR_ADDRESS || '0x0',
                    SPONSOR_PRIVATE_KEY: process.env.SPONSOR_PRIVATE_KEY || '0x0',
                    STARKNET_RPC_URL: process.env.STARKNET_RPC_URL || ''
                }
            }, (error, stdout, stderr) => {
                if (error) {
                    console.error('[API] Script Error:', stderr);
                    resolve(NextResponse.json({ error: 'Claim failed', details: stderr || stdout }, { status: 500 }));
                    return;
                }

                console.log('[API] Script Output:', stdout);

                // Parse Tx Hashes from stdout (new format)
                // Parse Atomic Tx Hash
                const txMatch = stdout.match(/TX Hash: (0x[0-9a-fA-F]+)/);
                const deployedMatch = stdout.match(/Deployed: (False|True)/);

                const mainTxHash = txMatch ? txMatch[1] : null;
                const wasDeployed = deployedMatch ? deployedMatch[1] === 'False' : true; // "False" means it wasn't deployed yet, so it WILL be deployed in this TX. Wait, Line 198 says "Deployed: True" if it exists. So False means it needs deployment.

                // Logic:
                // Script prints "Deployed: True" if it IS deployed.
                // If "Deployed: True" -> No deployment in this TX -> deployTxHash = null.
                // If "Deployed: False" -> Deployment happens in this TX -> deployTxHash = mainTxHash.

                const deployTxHash = (deployedMatch && deployedMatch[1] === 'False') ? mainTxHash : null;
                const transferTxHash = mainTxHash;

                resolve(NextResponse.json({
                    success: true,
                    logs: stdout,
                    deployTxHash,
                    transferTxHash
                }));
            });
        });

    } catch (e) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
