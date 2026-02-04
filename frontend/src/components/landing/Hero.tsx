'use client';

import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { ArrowRight, Shield } from 'lucide-react';
import Link from 'next/link';

export function Hero() {
    return (
        <section className="relative min-h-[90vh] flex flex-col items-center justify-center overflow-hidden px-4">
            {/* Background Elements */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] bg-primary/20 blur-[100px] rounded-full animate-float delay-0" />
                <div className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] bg-purple-500/20 blur-[100px] rounded-full animate-float delay-1000" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="text-center space-y-8 relative z-10 max-w-4xl"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-sm text-primary text-sm font-medium mb-4"
                >
                    <Shield className="w-4 h-4" />
                    <span>Private Transactions on Starknet</span>
                </motion.div>

                <h1 className="text-6xl md:text-8xl font-bold tracking-tighter leading-none bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/40">
                    Invisible is the <br />
                    <span className="text-primary text-gradient">New Standard</span>
                </h1>

                <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    The non-interactive stealth address protocol that brings privacy to everyone. Send funds securely without revealing the recipient.
                </p>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-wrap items-center justify-center gap-4 pt-4"
                >
                    <Link href="/dashboard">
                        <Button size="lg" className="h-14 px-8 rounded-full text-lg gap-2 shadow-2xl shadow-primary/20">
                            Launch App <ArrowRight className="w-5 h-5" />
                        </Button>
                    </Link>
                    <Button variant="outline" size="lg" className="h-14 px-8 rounded-full text-lg hover:bg-muted/50">
                        Read Documentation
                    </Button>
                </motion.div>

                {/* Stats Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-16 border-t border-border/40 mt-16 max-w-3xl mx-auto">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-foreground">1-byte</div>
                        <div className="text-sm text-muted-foreground">View Tags</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl font-bold text-foreground">$0</div>
                        <div className="text-sm text-muted-foreground">Extra Gas</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl font-bold text-foreground">100%</div>
                        <div className="text-sm text-muted-foreground">Non-Custodial</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl font-bold text-foreground">zk-STARK</div>
                        <div className="text-sm text-muted-foreground">Powered</div>
                    </div>
                </div>
            </motion.div>
        </section>
    );
}
