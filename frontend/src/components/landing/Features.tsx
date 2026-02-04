'use client';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Shield, Zap, Eye, Lock, Globe, Wallet } from 'lucide-react';

const features = [
    {
        icon: <Shield className="w-6 h-6 text-blue-500" />,
        title: "Total Privacy",
        description: "Transactions generate unique one-time addresses. Only you and the sender know who received the funds."
    },
    {
        icon: <Zap className="w-6 h-6 text-yellow-500" />,
        title: "Gasless Claims",
        description: "Receive funds in a fresh wallet with 0 ETH. Our Paymaster sponsors the gas for your first claim."
    },
    {
        icon: <Eye className="w-6 h-6 text-purple-500" />,
        title: "Instant Scanning",
        description: "Uses 1-byte filtered view tags to scan millions of transactions in seconds client-side."
    },
    {
        icon: <Lock className="w-6 h-6 text-green-500" />,
        title: "Elliptic Curve Security",
        description: "Built on secp256k1 (Bitcoin curve) for robust cryptographic security powered by Garaga."
    },
    {
        icon: <Globe className="w-6 h-6 text-cyan-500" />,
        title: "Universal Access",
        description: "Works with any standard Starknet wallet (ArgentX, Braavos). No meaningful UX friction."
    },
    {
        icon: <Wallet className="w-6 h-6 text-pink-500" />,
        title: "Non-Custodial",
        description: "You hold the keys. The protocol never touches your private keys or funds."
    }
];

export function Features() {
    return (
        <section className="py-24 px-6 md:px-12 bg-secondary/20 relative">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16 space-y-4">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Why StealthFlow?</h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Advanced privacy features built natively on Starknet's high-performance L2.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, i) => (
                        <Card key={i} className="bg-background/50 backdrop-blur-sm hover:border-primary/50 transition-colors duration-300">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-lg bg-background border flex items-center justify-center mb-4">
                                    {feature.icon}
                                </div>
                                <CardTitle className="text-xl">{feature.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground leading-relaxed">
                                    {feature.description}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}
