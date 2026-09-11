import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Explore DAVID — A team built around your business",
  description:
    "Explore an isolated, illustrative DAVID specialist team and planning scenario. No customer data or live execution.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
