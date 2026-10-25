import { useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "../i18n";
import "./error-notice.css";

/** Dismisses presentation only; validation guards and recorded failures remain. */
export function ErrorNotice({ message, children, className = "" }: { message: string; children?: ReactNode; className?: string }) {
  const { language } = useLanguage();
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { setDismissed(false); }, [message]);
  if (!message || dismissed) return null;
  const label = language === "es" ? "Cerrar mensaje de error" : "Dismiss error message";
  return <div role="alert" className={`error-message error-notice ${className}`}>
    <div className="error-notice-content">{message}{children}</div>
    <button type="button" className="error-dismiss" aria-label={label} title={label} onClick={() => setDismissed(true)}><span aria-hidden="true">×</span></button>
  </div>;
}
