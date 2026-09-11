import type { Metadata } from "next";
import "../../web/app/globals.css";
import "../../web/app/product-design.css";
export const metadata: Metadata = {
  title: "Revengine · DAVID Engine",
  description: "Explore DAVID Engine with synthetic workspaces. Browser demo; live integrations are disconnected.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
