import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { PwaRegistration } from "@/components/pwa-registration";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-atlas", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Atlas Finance", template: "%s | Atlas Finance" },
  description: "Organização financeira clara, precisa e orientada pelos seus próprios dados.",
  applicationName: "Atlas Finance",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Atlas Finance", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#062d31", colorScheme: "light", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR" className={manrope.variable}><body><Providers>{children}</Providers><PwaRegistration /></body></html>;
}
