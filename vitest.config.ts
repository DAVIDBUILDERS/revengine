import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({resolve:{alias:Object.fromEntries(['contracts','domain','agents','db','connectors','orchestration','ai','observability'].map(p=>[`@david/${p}`,resolve(`packages/${p}/src/index.ts`)]))},test:{include:['tests/**/*.test.ts','packages/*/src/**/*.test.ts'],exclude:['**/node_modules/**','tests/e2e/**'],testTimeout:15000}});
