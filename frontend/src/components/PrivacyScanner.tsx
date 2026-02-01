// 'use client';

// import { useState, useEffect, useCallback } from 'react';
// import { RpcProvider } from 'starknet';
// import {
//     checkStealthPayment,
//     Point,
//     generateKeypair,
//     computeStealthPrivKey,
//     getPublicKey,
//     formatPoint
// } from '../stealth-crypto';
// import { parseEphemeralPubkeyFromEvent, AnnouncementEvent } from '../eventScanner';
// import { CONTRACTS, getProvider } from '../contracts';

// interface ScanEntry {
//     id: string;
//     timestamp: Date;
//     viewTag: number;
//     ephemeralPub: Point;
//     isMatch: boolean;
//     schemeId: number;
//     txHash: string;
//     blockNumber: number;
// }

// interface DiscoveredFund {
//     stealthPub: Point;
//     stealthPriv: bigint;
//     ephemeralPub: Point;
//     amount: string;
//     token: string;
//     txHash: string;
// }

// interface Props {
//     onFundDiscovered: (fund: DiscoveredFund) => void;
// }

// export function PrivacyScanner({ onFundDiscovered }: Props) {
//     const [isScanning, setIsScanning] = useState(false);
//     const [scanLog, setScanLog] = useState<ScanEntry[]>([]);
//     const [discoveredFunds, setDiscoveredFunds] = useState<DiscoveredFund[]>([]);
//     const [viewPriv, setViewPriv] = useState<bigint | null>(null);
//     const [spendPub, setSpendPub] = useState<Point | null>(null);
//     const [spendPriv, setSpendPriv] = useState<bigint | null>(null);
//     const [scanStats, setScanStats] = useState({ total: 0, filtered: 0, matches: 0 });

//     // Key input fields
//     const [viewPrivInput, setViewPrivInput] = useState('');
//     const [spendPrivInput, setSpendPrivInput] = useState('');
//     const [keysSet, setKeysSet] = useState(false);

//     // Set keys from input
//     const handleSetKeys = () => {
//         try {
//             const vPriv = BigInt(viewPrivInput);
//             const sPriv = BigInt(spendPrivInput);
//             setViewPriv(vPriv);
//             setSpendPriv(sPriv);
//             // Derive spend public key from private
//             const sPub = getPublicKey(sPriv);
//             setSpendPub(sPub);
//             setKeysSet(true);
//         } catch (e) {
//             console.error('Invalid key format:', e);
//         }
//     };

//     // Fetch real events from StealthAnnouncer
//     const [scanError, setScanError] = useState<string | null>(null);

//     const fetchRealEvents = useCallback(async () => {
//         if (!viewPriv || !spendPub || !spendPriv) return;

//         setScanError(null);

//         try {
//             const provider = getProvider('sepolia');

//             // Get recent block number first
//             const blockNumber = await provider.getBlockNumber();
//             console.log('[Scanner] Current block:', blockNumber);

//             // Only fetch last 10000 blocks to avoid timeout
//             const fromBlock = Math.max(0, blockNumber - 10000);

//             // Get events from StealthAnnouncer
//             console.log('[Scanner] Fetching events from contract:', CONTRACTS.STEALTH_ANNOUNCER);
//             console.log('[Scanner] Block range:', fromBlock, '->', blockNumber);

//             const events = await provider.getEvents({
//                 address: CONTRACTS.STEALTH_ANNOUNCER,
//                 from_block: { block_number: fromBlock },
//                 to_block: { block_number: blockNumber },
//                 keys: [], // All events
//                 chunk_size: 100
//             });

//             console.log('[Scanner] Found events:', events.events.length);

//             if (events.events.length === 0) {
//                 setScanError('No announcements found in recent blocks');
//                 return;
//             }

//             for (const event of events.events) {
//                 console.log('[Scanner] Processing event:', event);

//                 // Parse event data
//                 // Event keys: [event_selector, scheme_id_low, scheme_id_high, view_tag]
//                 // Note: view_tag is the 4th key (index 3)
//                 const viewTag = event.keys.length > 3 ? Number(event.keys[3]) : 0;

//                 // Parse ephemeral pubkey from event data
//                 // data structure for Array<u256>: [array_len, elem0_low, elem0_high, elem1_low, elem1_high, ...]
//                 if (event.data.length >= 5) {
//                     // Skip array length (data[0]), then get x and y as u256 (each has low, high)
//                     const ephXLow = BigInt(event.data[1] || '0');
//                     const ephXHigh = BigInt(event.data[2] || '0');
//                     const ephYLow = BigInt(event.data[3] || '0');
//                     const ephYHigh = BigInt(event.data[4] || '0');

//                     // Reconstruct u256: value = low + (high << 128)
//                     const ephX = ephXLow + (ephXHigh << BigInt(128));
//                     const ephY = ephYLow + (ephYHigh << BigInt(128));

//                     console.log('[Scanner] Parsed ephemeral pub:', { x: ephX.toString(16), y: ephY.toString(16) });

//                     const ephemeralPub: Point = { x: ephX, y: ephY };

//                     const entryId = event.transaction_hash + '-' + event.block_number;

//                     // Check if already processed
//                     if (scanLog.find(e => e.id === entryId)) continue;

//                     const entry: ScanEntry = {
//                         id: entryId,
//                         timestamp: new Date(),
//                         viewTag,
//                         ephemeralPub,
//                         isMatch: false,
//                         schemeId: 1,
//                         txHash: event.transaction_hash,
//                         blockNumber: event.block_number || 0
//                     };

//                     // Check if this matches our viewing key
//                     const result = checkStealthPayment(
//                         viewPriv,
//                         spendPub,
//                         ephemeralPub,
//                         viewTag
//                     );

//                     console.log('[Scanner] Match result:', result !== null ? 'MATCH!' : 'no match');

//                     if (result !== null) {
//                         entry.isMatch = true;

//                         // Derive stealth private key
//                         const stealthPriv = computeStealthPrivKey(spendPriv, result);
//                         const stealthPub = getPublicKey(stealthPriv);

//                         const fund: DiscoveredFund = {
//                             stealthPub,
//                             stealthPriv,
//                             ephemeralPub,
//                             amount: 'Check balance',
//                             token: 'STRK',
//                             txHash: event.transaction_hash
//                         };

//                         setDiscoveredFunds(prev => [...prev, fund]);
//                         onFundDiscovered(fund);

//                         setScanStats(prev => ({
//                             ...prev,
//                             total: prev.total + 1,
//                             matches: prev.matches + 1
//                         }));
//                     } else {
//                         setScanStats(prev => ({
//                             ...prev,
//                             total: prev.total + 1,
//                             filtered: prev.filtered + 1
//                         }));
//                     }

//                     setScanLog(prev => [entry, ...prev].slice(0, 50));
//                 }
//             }
//         } catch (error) {
//             console.error('[Scanner] Error fetching events:', error);
//             setScanError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
//         }
//     }, [viewPriv, spendPub, spendPriv, onFundDiscovered, scanLog]);

//     // Simulate scanning announcements
//     const simulateScan = useCallback(() => {
//         if (!viewPriv || !spendPub || !spendPriv) return;

//         // Generate a mock announcement
//         const mockEphemeralPub = generateKeypair().publicKey;
//         const mockViewTag = Math.floor(Math.random() * 256);
//         const mockSchemeId = 1;
//         const mockTxHash = '0x' + Array(64).fill(0).map(() =>
//             Math.floor(Math.random() * 16).toString(16)
//         ).join('');

//         const entry: ScanEntry = {
//             id: Date.now().toString(),
//             timestamp: new Date(),
//             viewTag: mockViewTag,
//             ephemeralPub: mockEphemeralPub,
//             isMatch: false,
//             schemeId: mockSchemeId,
//             txHash: mockTxHash,
//             blockNumber: Math.floor(Math.random() * 1000000) + 500000
//         };

//         // Check if this matches our viewing key
//         const result = checkStealthPayment(
//             viewPriv,
//             spendPub,
//             mockEphemeralPub,
//             mockViewTag
//         );

//         if (result !== null) {
//             entry.isMatch = true;

//             // Derive stealth private key
//             const stealthPriv = computeStealthPrivKey(spendPriv, result);
//             const stealthPub = getPublicKey(stealthPriv);

//             const fund: DiscoveredFund = {
//                 stealthPub,
//                 stealthPriv,
//                 ephemeralPub: mockEphemeralPub,
//                 amount: (Math.random() * 10).toFixed(4),
//                 token: ['ETH', 'STRK', 'USDC'][Math.floor(Math.random() * 3)],
//                 txHash: mockTxHash
//             };

//             setDiscoveredFunds(prev => [...prev, fund]);
//             onFundDiscovered(fund);

//             setScanStats(prev => ({
//                 ...prev,
//                 total: prev.total + 1,
//                 matches: prev.matches + 1
//             }));
//         } else {
//             setScanStats(prev => ({
//                 ...prev,
//                 total: prev.total + 1,
//                 filtered: prev.filtered + 1
//             }));
//         }

//         setScanLog(prev => [entry, ...prev].slice(0, 50));
//     }, [viewPriv, spendPub, spendPriv, onFundDiscovered]);

//     // Process real contract Announcement events
//     const processContractEvent = useCallback((event: AnnouncementEvent) => {
//         if (!viewPriv || !spendPub || !spendPriv) return;

//         const entry: ScanEntry = {
//             id: event.txHash + '-' + event.blockNumber,
//             timestamp: new Date(),
//             viewTag: event.viewTag,
//             ephemeralPub: event.ephemeralPubkey, // Already parsed via parseEphemeralPubkeyFromEvent
//             isMatch: false,
//             schemeId: Number(event.schemeId),
//             txHash: event.txHash,
//             blockNumber: event.blockNumber
//         };

//         // Check if this matches our viewing key
//         const result = checkStealthPayment(
//             viewPriv,
//             spendPub,
//             event.ephemeralPubkey,
//             event.viewTag
//         );

//         if (result !== null) {
//             entry.isMatch = true;

//             // Derive stealth private key
//             const stealthPriv = computeStealthPrivKey(spendPriv, result);
//             const stealthPub = getPublicKey(stealthPriv);

//             const fund: DiscoveredFund = {
//                 stealthPub,
//                 stealthPriv,
//                 ephemeralPub: event.ephemeralPubkey,
//                 amount: 'Unknown', // Would need to query balance
//                 token: 'UNKNOWN',  // Would need to decode ciphertext or check balances
//                 txHash: event.txHash
//             };

//             setDiscoveredFunds(prev => [...prev, fund]);
//             onFundDiscovered(fund);

//             setScanStats(prev => ({
//                 ...prev,
//                 total: prev.total + 1,
//                 matches: prev.matches + 1
//             }));
//         } else {
//             setScanStats(prev => ({
//                 ...prev,
//                 total: prev.total + 1,
//                 filtered: prev.filtered + 1
//             }));
//         }

//         setScanLog(prev => [entry, ...prev].slice(0, 50));
//     }, [viewPriv, spendPub, spendPriv, onFundDiscovered]);

//     // Scanning: fetch real events when started
//     useEffect(() => {
//         if (!isScanning || !keysSet) return;

//         // Fetch real events once, then poll
//         fetchRealEvents();
//         const interval = setInterval(fetchRealEvents, 5000);
//         return () => clearInterval(interval);
//     }, [isScanning, keysSet, fetchRealEvents]);

//     return (
//         <div className="space-y-6">
//             {/* Header */}
//             <div className="flex items-center justify-between">
//                 <div>
//                     <h2 className="text-xl font-semibold text-[var(--foreground)] mb-1">
//                         Privacy Scanner
//                     </h2>
//                     <p className="text-[var(--text-secondary)] text-sm">
//                         Real-time scanning for stealth payments using 1-byte View Tags
//                     </p>
//                 </div>
//                 <button
//                     onClick={() => setIsScanning(!isScanning)}
//                     disabled={!keysSet}
//                     className={`${isScanning ? 'btn-secondary' : 'btn-primary'} ${!keysSet ? 'opacity-50 cursor-not-allowed' : ''}`}
//                 >
//                     {isScanning ? (
//                         <span className="flex items-center gap-2">
//                             <span className="status-dot warning animate-pulse" />
//                             Pause
//                         </span>
//                     ) : (
//                         <span className="flex items-center gap-2">
//                             <span className="status-dot success" />
//                             Start Scanning
//                         </span>
//                     )}
//                 </button>
//             </div>

//             {/* Key Input Section */}
//             {!keysSet ? (
//                 <div className="card border-[var(--accent-primary)] border-opacity-30">
//                     <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-4">
//                         🔑 Enter Your Private Keys to Scan
//                     </h3>
//                     <p className="text-xs text-[var(--text-muted)] mb-4">
//                         Get these from <code className="bg-[var(--surface)] px-1 rounded">python3 stealth_sdk.py --announce</code>
//                     </p>
//                     <div className="space-y-3">
//                         <div>
//                             <label className="text-xs text-[var(--text-muted)] block mb-1">View Private Key</label>
//                             <input
//                                 type="text"
//                                 className="input font-mono text-xs"
//                                 placeholder="0x5c46b5e558363b094b9af3b8cd51f7e6..."
//                                 value={viewPrivInput}
//                                 onChange={(e) => setViewPrivInput(e.target.value)}
//                             />
//                         </div>
//                         <div>
//                             <label className="text-xs text-[var(--text-muted)] block mb-1">Spend Private Key</label>
//                             <input
//                                 type="text"
//                                 className="input font-mono text-xs"
//                                 placeholder="0x17f736d188a2c9ad99ff34493473b03c..."
//                                 value={spendPrivInput}
//                                 onChange={(e) => setSpendPrivInput(e.target.value)}
//                             />
//                         </div>
//                         <button
//                             onClick={handleSetKeys}
//                             disabled={!viewPrivInput || !spendPrivInput}
//                             className={`w-full btn-primary ${!viewPrivInput || !spendPrivInput ? 'opacity-50' : ''}`}
//                         >
//                             Set Keys & Enable Scanning
//                         </button>
//                     </div>
//                 </div>
//             ) : (
//                 <div className="space-y-3">
//                     <div className="card bg-[var(--accent-success)] bg-opacity-10 border-[var(--accent-success)] border-opacity-30">
//                         <div className="flex items-center gap-2 text-[var(--accent-success)]">
//                             <span>✓</span>
//                             <span className="text-sm font-medium">Keys loaded - ready to scan for your payments</span>
//                         </div>
//                     </div>
//                     {scanError && (
//                         <div className="card bg-[var(--accent-error)] bg-opacity-10 border-[var(--accent-error)] border-opacity-30">
//                             <div className="text-sm text-[var(--accent-error)]">{scanError}</div>
//                         </div>
//                     )}
//                 </div>
//             )}

//             {/* Stats Bar */}
//             <div className="grid grid-cols-3 gap-4">
//                 <div className="card text-center">
//                     <div className="font-mono text-2xl font-bold text-[var(--foreground)]">
//                         {scanStats.total}
//                     </div>
//                     <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mt-1">
//                         Announcements
//                     </div>
//                 </div>
//                 <div className="card text-center">
//                     <div className="font-mono text-2xl font-bold text-[var(--accent-secondary)]">
//                         {scanStats.filtered}
//                     </div>
//                     <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mt-1">
//                         Filtered (Fast)
//                     </div>
//                 </div>
//                 <div className="card text-center">
//                     <div className="font-mono text-2xl font-bold text-[var(--accent-success)]">
//                         {scanStats.matches}
//                     </div>
//                     <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mt-1">
//                         Matches Found
//                     </div>
//                 </div>
//             </div>

//             {/* Discovered Funds */}
//             {discoveredFunds.length > 0 && (
//                 <div className="space-y-3">
//                     <h3 className="text-sm font-semibold text-[var(--accent-success)] uppercase tracking-wide">
//                         🎉 Secret Balances Found
//                     </h3>
//                     {discoveredFunds.map((fund, i) => (
//                         <div
//                             key={i}
//                             className="card-elevated border-[var(--accent-success)] border-opacity-50 flex items-center justify-between animate-fade-in glow-secondary"
//                         >
//                             <div className="flex items-center gap-4">
//                                 <div className="w-10 h-10 rounded-full bg-[var(--accent-success)] bg-opacity-20 flex items-center justify-center">
//                                     <span className="text-lg">💰</span>
//                                 </div>
//                                 <div>
//                                     <div className="font-semibold text-[var(--foreground)]">
//                                         {fund.amount} {fund.token}
//                                     </div>
//                                     <div className="text-xs font-mono text-[var(--text-muted)]">
//                                         {fund.txHash.slice(0, 10)}...{fund.txHash.slice(-8)}
//                                     </div>
//                                 </div>
//                             </div>
//                             <button
//                                 onClick={() => onFundDiscovered(fund)}
//                                 className="btn-primary text-sm"
//                             >
//                                 Claim Now →
//                             </button>
//                         </div>
//                     ))}
//                 </div>
//             )}

//             {/* Scan Terminal */}
//             <div className="card">
//                 <div className="flex items-center justify-between mb-4">
//                     <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
//                         Scan Log
//                     </h3>
//                     <div className="flex items-center gap-2">
//                         {isScanning && (
//                             <span className="flex items-center gap-1.5 text-xs text-[var(--accent-primary)]">
//                                 <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
//                                 Live
//                             </span>
//                         )}
//                     </div>
//                 </div>

//                 <div className="bg-[var(--background)] rounded-lg p-3 h-[240px] overflow-y-auto font-mono text-xs space-y-1.5">
//                     {scanLog.length === 0 ? (
//                         <div className="text-[var(--text-muted)] text-center py-8">
//                             Start scanning to see announcements...
//                         </div>
//                     ) : (
//                         scanLog.map((entry) => (
//                             <div
//                                 key={entry.id}
//                                 className={`flex items-center gap-2 py-1 px-2 rounded ${entry.isMatch
//                                     ? 'bg-[var(--accent-success)] bg-opacity-10 text-[var(--accent-success)]'
//                                     : 'text-[var(--text-muted)]'
//                                     }`}
//                             >
//                                 <span className="text-[var(--text-muted)]">
//                                     {entry.timestamp.toLocaleTimeString()}
//                                 </span>
//                                 <span className="view-tag text-[10px] py-0.5">
//                                     0x{entry.viewTag.toString(16).padStart(2, '0').toUpperCase()}
//                                 </span>
//                                 <span className="flex-1 truncate">
//                                     {entry.txHash.slice(0, 18)}...
//                                 </span>
//                                 {entry.isMatch ? (
//                                     <span className="text-[var(--accent-success)] font-semibold">
//                                         ✓ MATCH
//                                     </span>
//                                 ) : (
//                                     <span className="text-[var(--text-muted)]">
//                                         filtered
//                                     </span>
//                                 )}
//                             </div>
//                         ))
//                     )}
//                 </div>
//             </div>
//         </div>
//     );
// }



'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { CONTRACTS, getProvider, fetchAnnouncements, AnnouncementEvent } from '../contracts';

interface ScanEntry {
    id: string;
    timestamp: Date;
    viewTag: number;
    ephemeralPub: Point;
    isMatch: boolean;
    schemeId: number;
    txHash: string;
    blockNumber: number;
}

interface DiscoveredFund {
    stealthPub: Point;
    stealthPriv: bigint;
    ephemeralPub: Point;
    amount: string;
    token: string;
    txHash: string;
}

interface Props {
    onFundDiscovered: (fund: DiscoveredFund) => void;
}

export function PrivacyScanner({ onFundDiscovered }: Props) {
    const [isScanning, setIsScanning] = useState(false);
    const [scanLog, setScanLog] = useState<ScanEntry[]>([]);
    const [discoveredFunds, setDiscoveredFunds] = useState<DiscoveredFund[]>([]);
    const [viewPriv, setViewPriv] = useState<bigint | null>(null);
    const [spendPub, setSpendPub] = useState<Point | null>(null);
    const [spendPriv, setSpendPriv] = useState<bigint | null>(null);
    const [scanStats, setScanStats] = useState({ total: 0, filtered: 0, matches: 0 });
    const [scanError, setScanError] = useState<string | null>(null);

    // Key input fields
    const [viewPrivInput, setViewPrivInput] = useState('');
    const [spendPrivInput, setSpendPrivInput] = useState('');
    const [keysSet, setKeysSet] = useState(false);

    const lastScannedBlock = useRef<number>(0);

    // Set and Sanitize Keys
    const handleSetKeys = () => {
        try {
            const sanitize = (hex: string) => hex.startsWith('0x') ? hex : `0x${hex}`;
            const vPriv = BigInt(sanitize(viewPrivInput.trim()));
            const sPriv = BigInt(sanitize(spendPrivInput.trim()));

            setViewPriv(vPriv);
            setSpendPriv(sPriv);
            const sPub = getPublicKey(sPriv);
            setSpendPub(sPub);
            setKeysSet(true);
            setScanError(null);
        } catch (e) {
            setScanError('Invalid Key Format: Please use valid hex strings starting with 0x');
            console.error('[Scanner] Key error:', e);
        }
    };

    const runScannerLoop = useCallback(async () => {
        if (!viewPriv || !spendPub || !spendPriv) return;
        const provider = getProvider('sepolia');

        try {
            const currentBlock = await provider.getBlockNumber();
            // Scan last 2000 blocks on first run, then incremental
            const fromBlock = lastScannedBlock.current === 0
                ? Math.max(0, currentBlock - 2000)
                : lastScannedBlock.current + 1;

            if (fromBlock > currentBlock) return;

            const events = await fetchAnnouncements(provider, fromBlock, currentBlock);
            lastScannedBlock.current = currentBlock;

            for (const event of events) {
                // Check if already in log to prevent duplicates
                const entryId = `${event.txHash}-${event.blockNumber}`;
                if (scanLog.find(e => e.id === entryId)) return;

                const matchHash = checkStealthPayment(
                    viewPriv,
                    spendPub,
                    event.ephemeralPubkey,
                    event.viewTag
                );

                const entry: ScanEntry = {
                    id: entryId,
                    timestamp: new Date(),
                    viewTag: event.viewTag,
                    ephemeralPub: event.ephemeralPubkey,
                    isMatch: matchHash !== null,
                    schemeId: Number(event.schemeId),
                    txHash: event.txHash,
                    blockNumber: event.blockNumber
                };

                if (matchHash !== null) {
                    const stealthPriv = computeStealthPrivKey(spendPriv, matchHash);
                    const stealthPub = getPublicKey(stealthPriv);

                    // Decrypt metadata to get actual amount
                    // Compute shared secret: S = viewPriv * ephemeralPub
                    const sharedSecret = pointMul(viewPriv, event.ephemeralPubkey);
                    const { amountWei, amountFormatted } = decryptMetadata(sharedSecret.x, event.ciphertext);

                    let finalAmount = amountFormatted;

                    // Fallback: If amount is Unknown (legacy tx) or 0, fetch real balance
                    if (amountFormatted === 'Unknown' || amountWei === BigInt(0)) {
                        try {
                            const address = computeStealthAddress(stealthPub);
                            // Call balanceOf on STRK token
                            const result = await provider.callContract({
                                contractAddress: CONTRACTS.STRK,
                                entrypoint: 'balanceOf',
                                calldata: [address]
                            });
                            // Result is [low, high]
                            if (result && result.length >= 2) {
                                const balance = BigInt(result[0]) + (BigInt(result[1]) << BigInt(128));
                                finalAmount = formatWeiToToken(balance);
                                console.log('[Scanner] Fetched on-chain balance:', finalAmount);
                            }
                        } catch (e) {
                            console.warn('[Scanner] Failed to fetch balance:', e);
                        }
                    }

                    const fund: DiscoveredFund = {
                        stealthPub,
                        stealthPriv,
                        ephemeralPub: event.ephemeralPubkey,
                        amount: finalAmount,
                        token: 'STRK',
                        txHash: event.txHash
                    };

                    setDiscoveredFunds(prev => {
                        // Avoid duplicates in discovered funds list
                        if (prev.find(f => f.txHash === event.txHash)) return prev;
                        return [...prev, fund];
                    });
                    onFundDiscovered(fund);
                    setScanStats(s => ({ ...s, total: s.total + 1, matches: s.matches + 1 }));
                } else {
                    setScanStats(s => ({ ...s, total: s.total + 1, filtered: s.filtered + 1 }));
                }

                setScanLog(prev => [entry, ...prev].slice(0, 50));
            }
        } catch (error) {
            console.error('[Scanner] RPC error:', error);
            setScanError('Connection Error: Failed to fetch events from Sepolia.');
        }
    }, [viewPriv, spendPub, spendPriv, onFundDiscovered, scanLog]);

    // Polling logic
    useEffect(() => {
        if (!isScanning || !keysSet) return;

        runScannerLoop(); // Initial scan
        const interval = setInterval(runScannerLoop, 15000); // Poll every 15s
        return () => clearInterval(interval);
    }, [isScanning, keysSet, runScannerLoop]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-[var(--foreground)] mb-1">Privacy Scanner</h2>
                    <p className="text-[var(--text-secondary)] text-sm">Scanning for stealth payments on Sepolia</p>
                </div>
                <button
                    onClick={() => setIsScanning(!isScanning)}
                    disabled={!keysSet}
                    className={isScanning ? 'btn-secondary' : 'btn-primary'}
                >
                    {isScanning ? 'Pause Scanning' : 'Start Scanning'}
                </button>
            </div>

            {!keysSet && (
                <div className="card border-[var(--accent-primary)] border-opacity-30 p-4">
                    <h3 className="text-sm font-semibold mb-4 text-[var(--text-secondary)]">🔑 Enter Keys to Begin</h3>
                    <div className="space-y-4">
                        <input
                            className="input w-full font-mono text-xs"
                            placeholder="View Private Key (0x...)"
                            value={viewPrivInput}
                            onChange={(e) => setViewPrivInput(e.target.value)}
                        />
                        <input
                            className="input w-full font-mono text-xs"
                            placeholder="Spend Private Key (0x...)"
                            value={spendPrivInput}
                            onChange={(e) => setSpendPrivInput(e.target.value)}
                        />
                        <button onClick={handleSetKeys} className="btn-primary w-full">Set Keys</button>
                        {scanError && <p className="text-xs text-red-500 mt-2">{scanError}</p>}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-3 gap-4">
                <div className="card p-3 text-center">
                    <div className="text-2xl font-mono font-bold">{scanStats.total}</div>
                    <div className="text-xs text-[var(--text-muted)]">Parsed</div>
                </div>
                <div className="card p-3 text-center">
                    <div className="text-2xl font-mono font-bold text-[var(--accent-secondary)]">{scanStats.filtered}</div>
                    <div className="text-xs text-[var(--text-muted)]">Filtered</div>
                </div>
                <div className="card p-3 text-center">
                    <div className="text-2xl font-mono font-bold text-[var(--accent-success)]">{scanStats.matches}</div>
                    <div className="text-xs text-[var(--text-muted)]">Matches</div>
                </div>
            </div>

            <div className="card p-4 h-64 overflow-y-auto font-mono text-xs bg-black bg-opacity-20">
                {scanLog.map((entry) => (
                    <div key={entry.id} className={`py-1 ${entry.isMatch ? 'text-green-400' : 'text-gray-500'}`}>
                        [{new Date(entry.timestamp).toLocaleTimeString()}] Tag: 0x{entry.viewTag.toString(16).padStart(2, '0')} | {entry.txHash.slice(0, 20)}... {entry.isMatch ? 'MATCH!' : ''}
                    </div>
                ))}
            </div>
        </div>
    );
}