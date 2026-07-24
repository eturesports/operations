import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ETURE Sports · Database",
  description: "Plataforma unificada de operaciones de Eture Sports",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
