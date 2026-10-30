import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Tipografía sans redondeada, ligera y muy legible.
const nunito = Nunito({ variable: "--font-sans", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Asistente Neo · Registro persona natural (prototipo)",
  description:
    "Prototipo académico de asistente conversacional con IA que guía el registro de persona natural para solicitar ofertas de microcrédito.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4b4a7a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO" className={`${nunito.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
