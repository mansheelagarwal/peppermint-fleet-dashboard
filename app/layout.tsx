import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Peppermint Fleet Operations",
  description: "A real-time operations dashboard for monitoring a mobile robot fleet.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
