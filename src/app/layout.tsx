import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AquaBridge",
  description: "AquaBridge — structured, inclusive, developmental swim coaching.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
