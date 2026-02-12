'use client';

import { FaXTwitter, FaGithub } from "react-icons/fa6";
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
                    © 2026 StealthFlow Protocol.
                </div>

                <div className="flex gap-6">
                    <Link href="https://github.com/SuyashAlphaC/Stealthflow" target="_blank" className="text-muted-foreground hover:text-foreground transition-colors">
                        <FaGithub size={24} />

                    </Link>
                    <Link href="https://x.com/stealthflowHQ" target="_blank" className="text-muted-foreground hover:text-foreground transition-colors">
                        <FaXTwitter size={24} />

                    </Link>
                </div>
            </div>
        </footer>
    );
}
