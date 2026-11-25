import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandMenu } from "@/components/command-menu";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXTAUTH_URL || "https://project-flow-core.vercel.app";
const DESCRIPTION =
  "Gestão de projetos para times pequenos: quadro kanban, sprints, relatórios e documentos no mesmo lugar.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Project Flow", template: "%s · Project Flow" },
  description: DESCRIPTION,
  applicationName: "Project Flow",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Project Flow",
    title: "Project Flow",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: "Project Flow", description: DESCRIPTION },
  // telas do app são privadas: só a página inicial e os textos legais entram em buscadores
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: o next-themes põe a classe do tema no <html> antes da hidratação
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>{children}</TooltipProvider>
          {/* lê a rota atual (usePathname): fica fora do HTML pré-renderizado */}
          <Suspense fallback={null}>
            <CommandMenu />
          </Suspense>
          <Toaster />
          {/* sem cookies e sem identificar a pessoa; só coletam na Vercel, com o recurso ligado no painel */}
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
