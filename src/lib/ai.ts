import { createAnthropic } from '@ai-sdk/anthropic';
import { env } from '@/lib/env';

// baseURL is explicit, not left to auto-pickup: this machine has an ambient
// ANTHROPIC_BASE_URL env var set to "https://api.anthropic.com" (missing /v1), which
// @ai-sdk/anthropic otherwise reads automatically and silently 404s every request
// against. Not a project var, don't touch it system-wide, just don't depend on it here.
export const anthropic = createAnthropic({
  apiKey: env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com/v1',
});
