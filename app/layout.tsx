import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/layout/SkipLink";
import { WalletProvider } from "@/components/wallet/WalletProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Stellar Stream Hive — Stream payments by the second",
  description:
    "Create real-time payment streams on Stellar. Employers stream salaries by the second; recipients watch balances accrue live and withdraw whenever they want.",
  metadataBase: new URL("https://stellar-stream-hive.example"),
  openGraph: {
    title: "Stellar Stream Hive",
    description: "Stream payments by the second on Stellar.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0e14",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} dark`}>
      <body className="flex min-h-screen flex-col bg-background font-sans text-white">
        <WalletProvider>
          <SkipLink />
          <NavBar />
          <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 focus:outline-none">
            {children}
          </main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
