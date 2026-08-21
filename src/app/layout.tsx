import type { Metadata } from "next";
import { Noto_Sans_JP, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { PartAssemblyProvider } from "@/lib/store/PartAssemblyProvider";
import { AppShell } from "@/components/layout/AppShell";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sekkei-Hub",
  description: "技術データ管理システム",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${geistMono.variable} h-full`}>
      <body className="h-full antialiased">
        <LanguageProvider>
          <PartAssemblyProvider>
            <AppShell>{children}</AppShell>
          </PartAssemblyProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
