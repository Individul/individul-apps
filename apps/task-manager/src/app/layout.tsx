import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sarcini · Secția evidența deținuți",
  description: "Gestionarea sarcinilor — Secția evidența deținuți",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
