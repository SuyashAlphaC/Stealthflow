
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { stealthPriv, recipient } = body;

        if (!stealthPriv || !recipient) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // Path to script
        // We assume the Next.js is running in frontend/
        // Script is in ../scripts/claim_stealth.py
        const scriptPath = path.resolve(process.cwd(), '../scripts/claim_stealth.py');

        // Command
        // python3 scripts/claim_stealth.py --execute --stealth-priv <PRIV> --to <RECIPIENT>
        const command = `python3 "${scriptPath}" --execute --stealth-priv ${stealthPriv} --to ${recipient}`;

        console.log('[API] Executing claim script:', command);

        return new Promise((resolve) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error('[API] Script Error:', stderr);
                    resolve(NextResponse.json({ error: 'Claim failed', details: stderr }, { status: 500 }));
                    return;
                }

                console.log('[API] Script Output:', stdout);
                resolve(NextResponse.json({ success: true, logs: stdout }));
            });
        });

    } catch (e) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
