import type { Metadata } from "next";
import { Inter, Barlow_Condensed } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  title: "2026 VM-tips",
  description: "Tippa VM 2026 med dina vänner",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <body className={`${inter.variable} ${barlowCondensed.variable} ${inter.className}`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
