import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_JP, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { PartAssemblyProvider } from "@/lib/store/PartAssemblyProvider";
import { NavSettingsProvider } from "@/lib/store/NavSettingsProvider";
import { AppShell } from "@/components/layout/AppShell";

// Primary UI font for Latin text/numbers — bolder, rounder letterforms.
// Japanese glyphs (not covered by this font) fall through to Noto Sans JP
// automatically via the font-family stack in globals.css.
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

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
    <html
      lang="ja"
      className={`${plusJakartaSans.variable} ${notoSansJP.variable} ${geistMono.variable} h-full`}
    >
      <body className="h-full antialiased">
        <LanguageProvider>
          <NavSettingsProvider>
            <PartAssemblyProvider>
              <AppShell>{children}</AppShell>
            </PartAssemblyProvider>
          </NavSettingsProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
