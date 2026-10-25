import { DomainError, object } from "./domain.ts";

export const SETTINGS_MAX_BUDGET_CENTS = 2000;
export const SETTINGS_MAX_STORAGE_BYTES = 2 * 1024 * 1024 * 1024;
export type StudioSettingsValues = {
  monthlyBudgetCents: number; processingBudgetCents: number; aiBudgetCents: number;
  storageLimitBytes: number; defaultDurationSeconds: number;
};
export type StudioSettings = StudioSettingsValues & { revision: number };
export type StudioSettingsResponse = {
  settings: StudioSettings;
  usage: { month: string; processingUsedCents: number; aiUsedCents: 0; storageBytes: number; reservedBytes: number };
  limits: { maxBudgetCents: number; maxStorageBytes: number };
  ai: { connected: false };
};
export function defaultStudioSettings(): StudioSettings {
  return { revision: 0, monthlyBudgetCents: 2000, processingBudgetCents: 1000, aiBudgetCents: 0,
    storageLimitBytes: SETTINGS_MAX_STORAGE_BYTES, defaultDurationSeconds: 20 };
}
/** Internal admission allocations. These values never enable an AI connection
 * and never represent a hard cap on the provider's account invoice. */
export function validateStudioSettings(value: unknown): StudioSettingsValues {
  const supplied = object(value);
  const keys = ["monthlyBudgetCents", "processingBudgetCents", "aiBudgetCents", "storageLimitBytes", "defaultDurationSeconds"] as const;
  if (Object.keys(supplied).length !== keys.length || Object.keys(supplied).some(key => !keys.includes(key as typeof keys[number])))
    throw new DomainError("Revisa los campos de configuración; no se admiten campos adicionales.");
  const result = {} as StudioSettingsValues;
  for (const key of keys) {
    const number = supplied[key];
    const maximum = key === "storageLimitBytes" ? SETTINGS_MAX_STORAGE_BYTES : key === "defaultDurationSeconds" ? 60 : SETTINGS_MAX_BUDGET_CENTS;
    const minimum = key === "defaultDurationSeconds" ? 5 : 0;
    if (typeof number !== "number" || !Number.isSafeInteger(number) || number < minimum || number > maximum)
      throw new DomainError(`Revisa ${key}: entero entre ${minimum} y ${maximum}.`);
    result[key] = number;
  }
  if (result.processingBudgetCents + result.aiBudgetCents > result.monthlyBudgetCents)
    throw new DomainError("La suma de procesamiento e IA no puede superar el presupuesto mensual interno.");
  return result;
}
