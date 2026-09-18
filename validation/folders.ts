import { z } from "zod";

export function createFolderSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t("requiredName")),
  });
}

export type CreateFolderValues = z.infer<ReturnType<typeof createFolderSchema>>;
