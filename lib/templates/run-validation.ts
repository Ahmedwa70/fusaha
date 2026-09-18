import vm from "node:vm";

export type ValidationResult = { errors: string[]; warnings: string[] };

// Admin-authored, untrusted code. `vm` is not a real security boundary (a
// determined script can still escape it), but it's enough to stop a
// slow/broken script from taking down generation — teachers must never see a
// technical failure here (PRD §7/§16). Real sandboxing (e.g. isolated-vm) is
// a follow-up, not this pass.
export function runTemplateValidation(validationScript: string, content: unknown): ValidationResult {
  try {
    const sandbox: { module: { exports?: unknown } } = { module: { exports: undefined } };
    vm.createContext(sandbox);
    vm.runInContext(validationScript, sandbox, { timeout: 2000 });

    const validate = sandbox.module.exports;
    if (typeof validate !== "function") return { errors: [], warnings: [] };

    const result = validate(content) as { errors?: unknown; warnings?: unknown } | null | undefined;
    if (!result || !Array.isArray(result.errors) || !Array.isArray(result.warnings)) {
      return { errors: [], warnings: [] };
    }
    return { errors: result.errors, warnings: result.warnings };
  } catch {
    return { errors: [], warnings: [] };
  }
}
