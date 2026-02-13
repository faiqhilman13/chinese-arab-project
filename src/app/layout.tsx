import type { Metadata } from "next";
import {
  Fira_Code,
  Noto_Sans_Arabic,
  Noto_Sans_SC,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  weight: ["400", "600"],
});

const notoSc = Noto_Sans_SC({
  variable: "--font-noto-sc",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Language Learning MVP",
  description: "Personal Arabic + Chinese baby-style language learning app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${firaCode.variable} ${notoArabic.variable} ${notoSc.variable} antialiased`}
      >
        <div className="min-h-screen p-6">
          <div className="mx-auto max-w-5xl">
            <Navigation />
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
