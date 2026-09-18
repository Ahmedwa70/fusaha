import "server-only";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { getSecretSetting, SETTINGS_KEYS } from "@/lib/admin/settings";

let cachedProvider: ReturnType<typeof createDeepSeek> | null = null;
let cachedApiKey: string | null = null;

// The key lives in `system_settings` (admin-managed, encrypted — see
// lib/admin/settings.ts), not `.env`, per client requirement. Re-reads on
// every call but only rebuilds the provider when the key actually changed,
// so an admin rotating the key takes effect on the next generation without
// a redeploy.
async function getDeepSeekProvider() {
  const apiKey = await getSecretSetting(SETTINGS_KEYS.deepseekApiKey);
  if (!apiKey) throw new Error("DeepSeek API key is not configured");
  if (!cachedProvider || cachedApiKey !== apiKey) {
    cachedProvider = createDeepSeek({ apiKey });
    cachedApiKey = apiKey;
  }
  return cachedProvider;
}

// deepseek-v4-flash: fast, cheap, 1M context — plenty for a <=2-page text
// source plus the full lesson schema in the prompt; used for text sources.
// deepseek-v4-flash-vision-exp: same tier but vision-capable, for image
// sources (§5.2A). Model names verified against
// https://api-docs.deepseek.com/quick_start/pricing/ — deepseek-chat /
// deepseek-reasoner (older training-data names) were retired.
export async function getDeepSeekTextModel() {
  return (await getDeepSeekProvider())("deepseek-v4-flash");
}

export async function getDeepSeekVisionModel() {
  return (await getDeepSeekProvider())("deepseek-v4-flash-vision-exp");
}
