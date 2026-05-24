function isHexColorToken(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  const h = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(h);
}

/**
 * Color labels: t("colors.<slug>") then t("<slug>") for English keys like t("orange").
 * Hex codes pass through unchanged.
 */
export function translateColorLabel(
  raw: string,
  t: (key: string) => string,
): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (isHexColorToken(trimmed)) {
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  }

  const normalized = trimmed
    .toLocaleLowerCase("mk-MK")
    .replace(/\s+/g, " ");
  const hyphen = normalized.replace(/ /g, "-");

  const tryKey = (key: string) => {
    const out = t(key);
    return out !== key ? out : null;
  };

  return (
    tryKey(`colors.${normalized}`) ??
    tryKey(`colors.${hyphen}`) ??
    tryKey(normalized) ??
    tryKey(hyphen) ??
    trimmed
  );
}
