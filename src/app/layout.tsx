import type { Metadata } from "next";
import { Geist, Geist_Mono, Cinzel, Inter, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

import { NavBar } from "@/components/layout/nav-bar";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/layout/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const shareTechMono = Share_Tech_Mono({
  variable: "--font-share-tech-mono",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "DnD Planner",
  description: "Plan campaigns, schedule sessions, and track your party.",
};

// Runs before hydration to apply the persisted skin without a flash,
// mirroring how next-themes handles the light/dark class toggle. Kept in
// sync manually with src/lib/skin.ts (STORAGE_KEY, SKINS) since an inline
// script can't import from app code.
const SKIN_BOOTSTRAP_SCRIPT = `(function(){try{if(localStorage.getItem("dnd-planner-skin")==="nier")document.documentElement.dataset.skin="nier";}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} ${inter.variable} ${shareTechMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKIN_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NavBar />
          <main className="flex flex-1 flex-col">{children}</main>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
