import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_JP, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { ActiveCaseProvider } from "@/lib/store/ActiveCaseProvider";
import { PartAssemblyProvider } from "@/lib/store/PartAssemblyProvider";
import { AppShell } from "@/components/layout/AppShell";
import { WelcomeIntro } from "@/components/layout/WelcomeIntro";

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
  title: "OKU-pro",
  description: "技術データ管理システム",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${plusJakartaSans.variable} ${notoSansJP.variable} ${geistMono.variable} h-full`}
    >
      <body className="h-full antialiased">
        {/* テーマ切替 (ThemeProvider) の反映はマウント後の useEffect なので、
            dark保存済みユーザーが一瞬だけlight既定値でペイントされるのを
            防ぐため、ハイドレーション前にこの同期スクリプトでdata-theme属性
            を先に付与する。 */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('sekkei.theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}",
          }}
        />
        <ThemeProvider>
          <LanguageProvider>
            <WelcomeIntro />
            <ActiveCaseProvider>
              <PartAssemblyProvider>
                <AppShell>{children}</AppShell>
              </PartAssemblyProvider>
            </ActiveCaseProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
