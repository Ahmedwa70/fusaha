"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";
import { recordAuditLog } from "@/lib/admin/audit-log";
import {
  setSecretSetting,
  setGenerationCost,
  setAutoPaymentEnabled,
  setWhatsappContactNumber,
  SETTINGS_KEYS,
  APP_SETTINGS_KEYS,
} from "@/lib/admin/settings";
import {
  updateDeepSeekApiKeySchema,
  updateGenerationCostSchema,
  updatePaymentSettingsSchema,
  type UpdateDeepSeekApiKeyValues,
  type UpdateGenerationCostValues,
  type UpdatePaymentSettingsValues,
} from "@/validation/settings";

export type SettingsActionState = { error: string } | { success: true };

export async function updateDeepSeekApiKey(data: UpdateDeepSeekApiKeyValues): Promise<SettingsActionState> {
  const admin = await requirePermission(Permissions.settingsUpdate);

  const tValidation = await getTranslations("validation.settings");
  const tErrors = await getTranslations("admin.settings.errors");
  const parsed = updateDeepSeekApiKeySchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidData") };

  await setSecretSetting(SETTINGS_KEYS.deepseekApiKey, parsed.data.apiKey, admin.id);

  // Never write the plaintext key to the audit log — record that the
  // setting changed, not its value.
  await recordAuditLog({
    userId: admin.id,
    action: Permissions.settingsUpdate,
    resourceType: "system-setting",
    resourceId: SETTINGS_KEYS.deepseekApiKey,
  });

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function updateGenerationCost(data: UpdateGenerationCostValues): Promise<SettingsActionState> {
  const admin = await requirePermission(Permissions.settingsUpdate);

  const tValidation = await getTranslations("validation.settings");
  const tErrors = await getTranslations("admin.settings.errors");
  const parsed = updateGenerationCostSchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidData") };

  await setGenerationCost(parsed.data.cost, admin.id);

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.settingsUpdate,
    resourceType: "app-setting",
    resourceId: APP_SETTINGS_KEYS.generationCost,
  });

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function updatePaymentSettings(data: UpdatePaymentSettingsValues): Promise<SettingsActionState> {
  const admin = await requirePermission(Permissions.settingsUpdate);

  const tValidation = await getTranslations("validation.settings");
  const tErrors = await getTranslations("admin.settings.errors");
  const parsed = updatePaymentSettingsSchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidData") };

  await setAutoPaymentEnabled(parsed.data.autoPaymentEnabled, admin.id);
  await setWhatsappContactNumber(parsed.data.whatsappContactNumber.trim(), admin.id);

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.settingsUpdate,
    resourceType: "app-setting",
    resourceId: APP_SETTINGS_KEYS.autoPaymentEnabled,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/dashboard/credits");
  return { success: true };
}
