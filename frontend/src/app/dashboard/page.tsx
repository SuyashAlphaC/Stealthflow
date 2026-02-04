'use client';

import Link from 'next/link';
import { useState } from 'react';
import { StealthSend, DebugData } from '../../components/StealthSend';
import { PrivacyScanner } from '../../components/PrivacyScanner';
import { GaslessClaim } from '../../components/GaslessClaim';
import { CryptoDebugger } from '../../components/CryptoDebugger';
import { WalletConnect } from '../../components/WalletConnect';

import { Point } from '../../stealth-crypto';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

import { Lock, Search, Zap, Bug, Github, Shield, Layers, Database, Eye } from 'lucide-react';
import { motion } from 'framer-motion';

// Mock Tabs since I didn't create them yet, or I can use state.
// I'll stick to state for now to match the previous implementation but use Button/Badge.

type TabId = 'send' | 'scan' | 'claim';

interface SelectedFund {
    stealthPub: Point;
    stealthPriv: bigint;
    ephemeralPub: Point;
    amount: string;
    token: string;
    txHash: string;
}

export default function Dashboard() {
    const [activeTab, setActiveTab] = useState<TabId>('send');
    const [debuggerOpen, setDebuggerOpen] = useState(false);
    const [debugData, setDebugData] = useState<DebugData>({});
    const [selectedFund, setSelectedFund] = useState<SelectedFund | null>(null);

    const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
        { id: 'send', label: 'Stealth Send', icon: <Lock className="w-4 h-4" /> },
        { id: 'scan', label: 'Privacy Scanner', icon: <Search className="w-4 h-4" /> },
        { id: 'claim', label: 'Gasless Claim', icon: <Zap className="w-4 h-4" /> },
    ];

    const handleFundDiscovered = (fund: SelectedFund) => {
        setSelectedFund(fund);
        setActiveTab('claim');
    };

    const handleShowDebugger = (data: DebugData) => {
        setDebugData(data);
        setDebuggerOpen(true);
    };

    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            {/* Background Gradients */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-primary/20 blur-[100px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-secondary/20 blur-[100px]" />
            </div>

            {/* Header */}
            <header className="relative border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <img
                            src="/Stealthflow_logo.png"
                            alt="StealthFlow Logo"
                            className="w-10 h-10 object-contain drop-shadow-[0_0_15px_rgba(45,212,191,0.5)]"
                        />
                        <div>
                            <h1 className="text-xl font-bold tracking-tight drop-shadow-[0_0_10px_rgba(45,212,191,0.3)]">
                                <span className="text-white">Stealth</span>
                                <span className="text-primary">Flow</span>
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                Non-Interactive Stealth Addresses
                            </p>
                        </div>
                    </Link>

                    <div className="flex items-center gap-4">
                        {/* ThemeToggle removed */}
                        <Button
                            variant={debuggerOpen ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setDebuggerOpen(!debuggerOpen)}
                            className="gap-2"
                        >
                            <Bug className="w-4 h-4" />
                            Debugger
                        </Button>
                        <WalletConnect />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="relative max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Sidebar - Protocol Stats */}
                    <aside className="lg:col-span-3 space-y-6">
                        <Card className="p-6 space-y-6">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                Protocol Stats
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Network</span>
                                    <Badge variant="success" className="gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                        Starknet Sepolia
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Announcements</span>
                                    <span className="font-mono text-sm text-primary">1,247</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Privacy Score</span>
                                    <span className="font-mono text-sm text-green-500">99.6%</span>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-6 space-y-4">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                Technology Stack
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center text-primary">
                                        <Shield className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium">secp256k1</div>
                                        <div className="text-xs text-muted-foreground">Bitcoin-compatible</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center text-primary">
                                        <Layers className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium">Garaga</div>
                                        <div className="text-xs text-muted-foreground">42-felt signatures</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center text-primary">
                                        <Database className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium">Paymaster</div>
                                        <div className="text-xs text-muted-foreground">Gasless claims</div>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-border/40">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                    Supported Wallets
                                </h4>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 border border-border/50">
                                        <img src="/argent_logo.png" alt="Argent" className="w-5 h-5 object-contain" />
                                        <span className="text-xs font-medium">Argent</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 border border-border/50">
                                        <img src="/braavos_logo.png" alt="Braavos" className="w-5 h-5 object-contain" />
                                        <span className="text-xs font-medium">Braavos</span>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-4 border-primary/20 bg-primary/5">
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="font-mono text-purple-500 border-purple-500/30 bg-purple-500/10">1-byte</Badge>
                                <span className="text-sm font-medium">View Tags</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Efficient scanning: 255/256 announcements filtered instantly using single-byte view tags.
                            </p>
                        </Card>
                    </aside>

                    {/* Main Panel */}
                    <div className="lg:col-span-9">
                        {/* Tab Navigation */}
                        <div className="flex items-center gap-2 mb-6 border-b border-border/50 pb-1">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-all relative
                    ${activeTab === tab.id
                                            ? 'text-primary bg-background border-b-2 border-primary'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                        }
                  `}
                                >
                                    {tab.icon}
                                    {tab.label}
                                    {tab.id === 'claim' && selectedFund && (
                                        <span className="absolute top-2 right-2 flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="relative min-h-[500px]">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                {activeTab === 'send' && (
                                    <StealthSend onShowDebugger={handleShowDebugger} />
                                )}
                                {activeTab === 'scan' && (
                                    <PrivacyScanner onFundDiscovered={handleFundDiscovered} />
                                )}
                                {activeTab === 'claim' && (
                                    <GaslessClaim
                                        fund={selectedFund}
                                        onClose={() => {
                                            setSelectedFund(null);
                                            setActiveTab('scan');
                                        }}
                                    />
                                )}
                            </motion.div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative border-t border-border mt-12 bg-muted/20">
                <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-muted-foreground">
                    <div>
                        © 2026 StealthFlow Protocol. Built on Starknet.
                    </div>
                    <div className="flex items-center gap-6">
                        <a href="https://github.com/SuyashAlphaC/Stealthflow" className="hover:text-foreground flex items-center gap-2 transition-colors">
                            <Github className="w-4 h-4" />
                            GitHub
                        </a>
                    </div>
                </div>
            </footer>

            {/* Crypto Debugger Modal */}
            <CryptoDebugger
                isOpen={debuggerOpen}
                onClose={() => setDebuggerOpen(false)}
                data={debugData}
            />
        </div>
    );
}
