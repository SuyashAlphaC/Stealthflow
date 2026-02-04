import type { Metadata } from "next";
import { Outfit, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { StarknetProvider } from "../providers/starknet-provider";
import { ThemeProvider } from "../providers/theme-provider";
import { Toaster } from "sonner";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${outfit.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <StarknetProvider>
            {children}
            <Toaster position="bottom-right" theme="system" />
          </StarknetProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
