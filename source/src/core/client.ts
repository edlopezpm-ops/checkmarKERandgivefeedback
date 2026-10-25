import type { Command, Workspace } from "./domain";
export async function request<T>(url: string, data?: unknown): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...(data === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Marker-Auth": "1" },
          body: JSON.stringify(data),
        }),
  });
  const result = await response.json();
  if (!response.ok) {
    const authErrors: Record<string, string> = { INVALID_CODE: 'Código inválido, vencido o ya utilizado. Solicita otro si lo necesitas.', RATE_LIMITED: 'Demasiados intentos. Espera antes de volver a solicitar un código.', AUTH_UNAVAILABLE: 'El acceso no está disponible en este momento.', CAPTCHA_REQUIRED: 'Completa la verificación de seguridad e inténtalo de nuevo.', CAPTCHA_INVALID: 'Completa la verificación de seguridad e inténtalo de nuevo.', CAPTCHA_UNAVAILABLE: 'La verificación de seguridad no está disponible. Vuelve a intentarlo.', ORIGIN_NOT_ALLOWED: 'Origen no permitido.', REQUEST_TIMEOUT: 'La solicitud tardó demasiado; inténtalo de nuevo.' };
    throw new Error(authErrors[result.error] ?? result.error ?? 'No se pudo completar la operación.');
  }
  return result as T;
}
export const loadWorkspace = () => request<Workspace>("/api/workspace");
export const sendCommand = (revision: number, command: Command) =>
  request<Workspace>("/api/commands", { revision, ...command });
export function exportText(filename: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/plain;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
