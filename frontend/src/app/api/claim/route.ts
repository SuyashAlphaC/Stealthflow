
import { NextResponse } from 'next/server';

/**
 * Gasless Claim API Route
 * 
 * NOTE: The Python gasless_claim.py script is now designed to be run manually
 * by the recipient, not via this API endpoint.
 * 
 * This endpoint is deprecated and returns instructions for manual claiming.
 * 
 * To claim funds, recipients should run the gasless_claim.py script directly:
 * 
 *   python3 scripts/gasless_claim.py --stealth-priv <KEY> --to <RECIPIENT_ADDRESS>
 * 
 */
export async function POST(req: Request) {
    return NextResponse.json({
        error: 'Manual claim required',
        message: 'Gasless claims must be executed manually using the gasless_claim.py script.',
        instructions: {
            step1: 'Download the gasless_claim.py script from the StealthFlow repository',
            step2: 'Set environment variables: SPONSOR_ADDRESS, SPONSOR_PRIVATE_KEY',
            step3: 'Run: python3 gasless_claim.py --stealth-priv <YOUR_KEY> --to <YOUR_WALLET>',
            documentation: 'See README.md for detailed instructions'
        }
    }, { status: 400 });
}

export async function GET() {
    return NextResponse.json({
        status: 'deprecated',
        message: 'This API endpoint is deprecated. Please use the gasless_claim.py script manually.',
        usage: 'python3 scripts/gasless_claim.py --stealth-priv <KEY> --to <RECIPIENT_ADDRESS>'
    });
}
