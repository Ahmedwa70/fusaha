import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemSettings, appSettings } from "@/database/schema";
import { decryptSecret } from "@/lib/crypto/secret-box";
import {
  maskSecret,
  SETTINGS_KEYS,
  APP_SETTINGS_KEYS,
  getGenerationCost,
  getAutoPaymentEnabled,
  getWhatsappContactNumber,
} from "@/lib/admin/settings";

export async function getGenerationCostSetting(): Promise<{ cost: number; updatedAt: Date | null }> {
  const [row] = await db
    .select({ updatedAt: appSettings.updatedAt })
    .from(appSettings)
    .where(eq(appSettings.key, APP_SETTINGS_KEYS.generationCost))
    .limit(1);

  return { cost: await getGenerationCost(), updatedAt: row?.updatedAt ?? null };
}

export async function getPaymentSettings(): Promise<{
  autoPaymentEnabled: boolean;
  whatsappContactNumber: string;
  updatedAt: Date | null;
}> {
  const rows = await db
    .select({ key: appSettings.key, updatedAt: appSettings.updatedAt })
    .from(appSettings)
    .where(inArray(appSettings.key, [APP_SETTINGS_KEYS.autoPaymentEnabled, APP_SETTINGS_KEYS.whatsappContactNumber]));

  const updatedAt = rows.reduce<Date | null>(
    (latest, row) => (!latest || row.updatedAt > latest ? row.updatedAt : latest),
    null
  );

  const [autoPaymentEnabled, whatsappContactNumber] = await Promise.all([
    getAutoPaymentEnabled(),
    getWhatsappContactNumber(),
  ]);

  return { autoPaymentEnabled, whatsappContactNumber, updatedAt };
}

export async function getDeepSeekApiKeyStatus(): Promise<{
  configured: boolean;
  masked: string | null;
  updatedAt: Date | null;
}> {
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, SETTINGS_KEYS.deepseekApiKey))
    .limit(1);

  if (!row) return { configured: false, masked: null, updatedAt: null };

  return {
    configured: true,
    masked: maskSecret(decryptSecret(row.encryptedValue)),
    updatedAt: row.updatedAt,
  };
}
