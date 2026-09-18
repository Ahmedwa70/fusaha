import { z } from "zod";

export function updateDeepSeekApiKeySchema(t: (key: string) => string) {
  return z.object({
    apiKey: z.string().min(10, t("invalidApiKey")),
  });
}

export type UpdateDeepSeekApiKeyValues = z.infer<ReturnType<typeof updateDeepSeekApiKeySchema>>;

export function updateGenerationCostSchema(t: (key: string) => string) {
  return z.object({
    cost: z.coerce.number().int().positive(t("invalidGenerationCost")),
  });
}

export type UpdateGenerationCostValues = z.infer<ReturnType<typeof updateGenerationCostSchema>>;

export function updatePaymentSettingsSchema(t: (key: string) => string) {
  return z
    .object({
      autoPaymentEnabled: z.boolean(),
      whatsappContactNumber: z.string(),
    })
    .refine((data) => data.autoPaymentEnabled || /^\+?[0-9]{8,15}$/.test(data.whatsappContactNumber.trim()), {
      message: t("invalidWhatsappNumber"),
      path: ["whatsappContactNumber"],
    });
}

export type UpdatePaymentSettingsValues = z.infer<ReturnType<typeof updatePaymentSettingsSchema>>;
