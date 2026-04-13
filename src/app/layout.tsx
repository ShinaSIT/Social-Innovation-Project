import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social Innovation Project",
  description: "Social Innovation Project",
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
