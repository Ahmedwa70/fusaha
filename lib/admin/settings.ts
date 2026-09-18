import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemSettings, appSettings } from "@/database/schema";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secret-box";
import { DEFAULT_GENERATION_COST } from "@/constants/lesson-source-limits";

// Keys for values stored in `system_settings`, encrypted at rest. Add new
// admin-managed secrets here rather than in `.env`.
export const SETTINGS_KEYS = {
  deepseekApiKey: "deepseek_api_key",
} as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

export async function getSecretSetting(key: SettingsKey): Promise<string | null> {
  const [row] = await db
    .select({ encryptedValue: systemSettings.encryptedValue })
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);
  if (!row) return null;
  return decryptSecret(row.encryptedValue);
}

export async function setSecretSetting(key: SettingsKey, value: string, updatedBy: string): Promise<void> {
  const encryptedValue = encryptSecret(value);
  await db
    .insert(systemSettings)
    .values({ key, encryptedValue, updatedBy })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { encryptedValue, updatedBy, updatedAt: new Date() },
    });
}

// Never render the plaintext back to the admin UI — show a masked preview
// (first/last 4 chars) so the admin can confirm which key is set without it
// being readable off the screen or in a screenshot.
export function maskSecret(value: string): string {
  if (value.length <= 8) return "•".repeat(8);
  return `${value.slice(0, 4)}${"•".repeat(8)}${value.slice(-4)}`;
}

// Keys for values stored in `app_settings`, plain (non-secret) admin-tunable
// business settings.
export const APP_SETTINGS_KEYS = {
  generationCost: "generation_cost",
  autoPaymentEnabled: "auto_payment_enabled",
  whatsappContactNumber: "whatsapp_contact_number",
} as const;

export async function getGenerationCost(): Promise<number> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, APP_SETTINGS_KEYS.generationCost))
    .limit(1);
  if (!row) return DEFAULT_GENERATION_COST;
  const parsed = Number(row.value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_GENERATION_COST;
}

export async function setGenerationCost(cost: number, updatedBy: string): Promise<void> {
  const value = String(cost);
  await db
    .insert(appSettings)
    .values({ key: APP_SETTINGS_KEYS.generationCost, value, updatedBy })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedBy, updatedAt: new Date() },
    });
}

// Whether teachers can pay via the automated Paddle checkout. When an admin
// turns this off (e.g. while Paddle isn't yet approved/live), the credits
// page falls back to a WhatsApp "contact us" button instead of BuyButton —
// see app/dashboard/credits. Defaults to on since that was the only
// behavior before this setting existed.
export async function getAutoPaymentEnabled(): Promise<boolean> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, APP_SETTINGS_KEYS.autoPaymentEnabled))
    .limit(1);
  return row ? row.value === "true" : true;
}

export async function setAutoPaymentEnabled(enabled: boolean, updatedBy: string): Promise<void> {
  const value = String(enabled);
  await db
    .insert(appSettings)
    .values({ key: APP_SETTINGS_KEYS.autoPaymentEnabled, value, updatedBy })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedBy, updatedAt: new Date() },
    });
}

export async function getWhatsappContactNumber(): Promise<string> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, APP_SETTINGS_KEYS.whatsappContactNumber))
    .limit(1);
  return row?.value ?? "";
}

export async function setWhatsappContactNumber(number: string, updatedBy: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: APP_SETTINGS_KEYS.whatsappContactNumber, value: number, updatedBy })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: number, updatedBy, updatedAt: new Date() },
    });
}
