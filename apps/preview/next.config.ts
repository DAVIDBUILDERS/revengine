import type { NextConfig } from "next";
const config: NextConfig = {
  output: "export",
  poweredByHeader: false,
  transpilePackages: ["@david/contracts", "@david/domain", "@david/agents", "@david/ui"],
};
export default config;
