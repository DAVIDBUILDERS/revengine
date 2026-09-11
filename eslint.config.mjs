import tseslint from 'typescript-eslint';
export default tseslint.config({ignores:['**/.next/**','**/node_modules/**','**/.well-known/workflow/**','**/next-env.d.ts','artifacts/**','playwright-report/**']}, ...tseslint.configs.recommended, {rules:{'@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}], '@typescript-eslint/no-explicit-any':'error'}});
