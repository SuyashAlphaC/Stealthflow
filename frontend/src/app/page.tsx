'use client';

import { useState } from 'react';
import { StealthSend, DebugData } from '../components/StealthSend';
import { PrivacyScanner } from '../components/PrivacyScanner';
import { GaslessClaim } from '../components/GaslessClaim';
import { CryptoDebugger } from '../components/CryptoDebugger';
import { WalletConnect } from '../components/WalletConnect';
import { Point } from '../stealth-crypto';

type TabId = 'send' | 'scan' | 'claim';

interface SelectedFund {
  stealthPub: Point;
  stealthPriv: bigint;
  ephemeralPub: Point;
  amount: string;
  token: string;
  txHash: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('send');
  const [debuggerOpen, setDebuggerOpen] = useState(false);
  const [debugData, setDebugData] = useState<DebugData>({});
  const [selectedFund, setSelectedFund] = useState<SelectedFund | null>(null);

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'send', label: 'Stealth Send', icon: '🔒' },
    { id: 'scan', label: 'Privacy Scanner', icon: '🔍' },
    { id: 'claim', label: 'Gasless Claim', icon: '⚡' },
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
    <div className="min-h-screen bg-[var(--background)]">
      {/* Background gradient effect */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255, 75, 43, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(138, 43, 226, 0.05) 0%, transparent 40%)'
        }}
      />

      {/* Header */}
      <header className="relative border-b border-[var(--border)] bg-[var(--surface)] bg-opacity-80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-white font-bold text-lg shadow-lg">
              S
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--foreground)]">
                StealthFlow
              </h1>
              <p className="text-xs text-[var(--text-muted)]">
                Non-Interactive Stealth Addresses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setDebuggerOpen(!debuggerOpen)}
              className={`btn-secondary text-sm py-2 px-3 flex items-center gap-2 ${debuggerOpen ? 'border-[var(--accent-secondary)] text-[var(--accent-secondary)]' : ''
                }`}
            >
              🔬 Debugger
            </button>
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar - Protocol Stats */}
          <aside className="lg:col-span-3 space-y-6">
            <div className="card">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-4">
                Protocol Stats
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-muted)]">Network</span>
                  <span className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
                    <span className="status-dot success" />
                    Starknet Sepolia
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-muted)]">Total Announcements</span>
                  <span className="font-mono text-sm text-[var(--accent-primary)]">1,247</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-muted)]">Privacy Score</span>
                  <span className="font-mono text-sm text-[var(--accent-success)]">99.6%</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-4">
                Technology Stack
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[var(--surface-elevated)] flex items-center justify-center text-sm">
                    🔐
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--foreground)]">secp256k1</div>
                    <div className="text-xs text-[var(--text-muted)]">Bitcoin-compatible</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[var(--surface-elevated)] flex items-center justify-center text-sm">
                    ⚡
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--foreground)]">Garaga</div>
                    <div className="text-xs text-[var(--text-muted)]">42-felt signatures</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[var(--surface-elevated)] flex items-center justify-center text-sm">
                    💰
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--foreground)]">Paymaster</div>
                    <div className="text-xs text-[var(--text-muted)]">Gasless claims</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card border-[var(--accent-secondary)] border-opacity-30">
              <div className="flex items-center gap-2 mb-2">
                <span className="view-tag">1-byte</span>
                <span className="text-sm font-medium text-[var(--foreground)]">View Tags</span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Efficient scanning: 255/256 announcements filtered instantly using single-byte view tags.
              </p>
            </div>
          </aside>

          {/* Main Panel */}
          <div className="lg:col-span-9">
            {/* Tab Navigation */}
            <div className="flex items-center gap-1 mb-6 border-b border-[var(--border)]">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`tab flex items-center gap-2 ${activeTab === tab.id ? 'active' : ''
                    }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.id === 'claim' && selectedFund && (
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-success)] animate-pulse" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="card min-h-[500px]">
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
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-[var(--border)] mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between text-sm text-[var(--text-muted)]">
          <div>
            © 2026 StealthFlow Protocol. Built on Starknet.
          </div>
          <div className="flex items-center gap-6">
            <a href="https://github.com" className="hover:text-[var(--foreground)]">
              GitHub
            </a>
            <a href="#" className="hover:text-[var(--foreground)]">
              Documentation
            </a>
            <a href="#" className="hover:text-[var(--foreground)]">
              Security
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
