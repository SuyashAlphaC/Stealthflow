'use client';

import { Github, Twitter } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
    return (
        <footer className="border-t border-border bg-background py-12 px-6">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
                        S
                    </div>
                    <span className="font-bold text-lg">StealthFlow</span>
                </div>

                <div className="text-sm text-muted-foreground text-center md:text-left">
                    © 2026 StealthFlow Protocol. Built on Starknet with ❤️.
                </div>

                <div className="flex gap-6">
                    <Link href="https://github.com" target="_blank" className="text-muted-foreground hover:text-foreground transition-colors">
                        <Github className="w-5 h-5" />
                    </Link>
                    <Link href="https://twitter.com" target="_blank" className="text-muted-foreground hover:text-foreground transition-colors">
                        <Twitter className="w-5 h-5" />
                    </Link>
                </div>
            </div>
        </footer>
    );
}
