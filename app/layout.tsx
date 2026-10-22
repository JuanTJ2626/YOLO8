import type { Metadata } from "next";
import { Inter, Syne, DM_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
  weight: ["700", "800"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "YOLO26n Vision — Detección Vehicular en Tiempo Real",
  description: "Sistema de detección inteligente de objetos con YOLO26n + ONNX Web.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${syne.variable} ${dmMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
