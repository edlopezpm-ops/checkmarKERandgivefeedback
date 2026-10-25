/** Display only natural language from the structured provider stream. Never
 * expose unfinished JSON or treat a partial proposal as an applicable result. */
export function progressiveAgentMessage(stream: string): string {
  try {
    const result = JSON.parse(stream);
    return typeof result?.message === "string" ? result.message : "";
  } catch { /* A live JSON response is normally incomplete. */ }
  const message = /^\s*\{\s*"message"\s*:\s*"((?:\\.|[^"\\])*)/s.exec(stream)?.[1];
  if (message === undefined) return "";
  // A chunk may end inside an escaped Unicode character. Keep the complete
  // prefix; at most six characters comprise one JSON escape sequence.
  for (let suffix = 0; suffix <= Math.min(6, message.length); suffix++) {
    try { return JSON.parse(`"${message.slice(0, message.length - suffix)}"`) as string; } catch { /* Wait for the rest of the escape. */ }
  }
  return "";
}
