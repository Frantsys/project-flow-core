import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandMenu } from "@/components/command-menu";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Project Flow", template: "%s · Project Flow" },
  description: "Workspaces, quadro kanban, sprints e documentos para times pequenos.",
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
        </ThemeProvider>
      </body>
    </html>
  );
}
