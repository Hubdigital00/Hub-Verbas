import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hub Verbas",
  description: "Atualização de verba dos clientes no ClickUp",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
