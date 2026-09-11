export async function register() { if (process.env.NEXT_RUNTIME === 'nodejs') { const { environment } = await import('../../packages/orchestration/src/environment'); environment(); } }
