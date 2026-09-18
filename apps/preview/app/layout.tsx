import type { Metadata } from "next";
import "../../web/app/globals.css";
import "../../web/app/product-design.css";
import "../../web/app/workspace-studio.css";
import "./wallaroo-only.css";
export const metadata: Metadata = {
  title: "Wallaroo Media · DAVID Engine",
  description: "Wallaroo Media workspace.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
