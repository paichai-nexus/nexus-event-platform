export function maskWinnerName(value: string) {
  const characters = Array.from(value.trim());
  if (characters.length <= 1) return characters[0] ? `${characters[0]}*` : "*";
  if (characters.length === 2) return `${characters[0]}*`;
  return `${characters[0]}${"*".repeat(Math.max(1, characters.length - 2))}${characters.at(-1)}`;
}

export function maskStudentNumber(value: string) {
  const normalized = value.trim().toUpperCase();
  if (normalized.length <= 4) return `${normalized.slice(0, 1)}***`;
  return `${normalized.slice(0, 4)}${"*".repeat(Math.min(6, normalized.length - 4))}`;
}
