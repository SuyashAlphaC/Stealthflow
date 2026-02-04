'use client';

import { ArrowRight } from 'lucide-react';

const steps = [
    {
        id: "01",
        title: "Generate Meta-Address",
        desc: "Create a static 'Meta-Address' that you can share publicly on social media or invoices."
    },
    {
        id: "02",
        title: "Sender Derives Key",
        desc: "Sender uses your meta-address to derive a unique Stealth Address on-chain."
    },
    {
        id: "03",
        title: "Funds Transferred",
        desc: "Assets are sent to this new stealth address. It looks like a random transfer to a fresh account."
    },
    {
        id: "04",
        title: "Private Claim",
        desc: "You scan the chain, find the funds using your view key, and claim them gaslessly."
    }
];

export function HowItWorks() {
    return (
        <section className="py-24 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">How it Works</h2>
                    <p className="text-lg text-muted-foreground">The lifecycle of a private transaction.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                    {/* Connection Line (Desktop) */}
                    <div className="hidden md:block absolute top-12 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-border to-transparent z-0" />

                    {steps.map((step, i) => (
                        <div key={i} className="relative z-10 pt-8 md:pt-0">
                            <div className="w-24 h-24 mb-6 rounded-2xl bg-background border border-border md:mx-auto flex items-center justify-center font-bold text-3xl text-primary shadow-lg">
                                {step.id}
                            </div>
                            <h3 className="text-xl font-bold mb-2 md:text-center">{step.title}</h3>
                            <p className="text-muted-foreground md:text-center text-sm leading-relaxed">
                                {step.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
