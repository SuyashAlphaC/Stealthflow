import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { StarknetProvider } from "../providers/starknet-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StealthFlow | Private Starknet Transactions",
  description: "Non-Interactive Stealth Address Protocol for Starknet. Send and receive funds privately with secp256k1 security.",
  keywords: ["Starknet", "Privacy", "Stealth Address", "Account Abstraction", "Garaga"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen`}
      >
        <StarknetProvider>
          {children}
        </StarknetProvider>
      </body>
    </html>
  );
}
