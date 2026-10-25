/** Display initials are derived from the profile, never an editable identity. */
export function deriveProfileInitials(name: string, email: string | null | undefined): string {
  const letters = (value: string) => value.match(/\p{L}/gu) ?? [];
  const nameParts = name.trim().split(/\s+/u).map(letters).filter(part => part.length);
  const localParts = (email ?? '').split('@')[0].split(/[._+-]+/u).map(letters).filter(part => part.length);
  const parts = nameParts.length ? nameParts : localParts;
  if (!parts.length) return '';
  const first = parts[0] ?? [], last = parts[parts.length - 1] ?? [];
  const initials = parts.length > 1 ? `${first[0] ?? ''}${last[0] ?? ''}` : first.slice(0, 2).join('');
  return Array.from(initials.toUpperCase()).slice(0, 4).join('');
}
