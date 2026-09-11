import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DAVID Engine — Your business, moving forward",
  description:
    "A shared operating workspace for your specialist team, decisions and source-linked results.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
