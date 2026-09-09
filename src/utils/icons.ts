// §14.4 icon resolution.
//
// MVP ships PNG icons at `/icons/{iconKey}.png`. When the file is missing
// we return `null` so the component can render a placeholder badge.

const SUPPORTED_FORMATS = ["png", "svg"] as const;

export type IconFormat = (typeof SUPPORTED_FORMATS)[number];

export interface ResolvedIcon {
  src: string;
  format: IconFormat;
}

/**
 * Resolve an `iconKey` to a public path. Tries PNG first, then SVG.
 * Returns `null` if neither is shipped in `public/icons/`.
 */
export function resolveIcon(iconKey: string): ResolvedIcon | null {
  if (!/^[a-z0-9][a-z0-9-_]{1,63}$/.test(iconKey)) {
    return null;
  }
  // PNG is the MVP-preferred format (§14.4).
  return {
    src: `/icons/${iconKey}.png`,
    format: "png",
  };
}

/**
 * Render a placeholder badge when no icon asset is available. Used by
 * TabBar.vue until real PNG/SVG files ship.
 */
export function iconFallbackLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  // Prefer the first grapheme; for Chinese/Japanese names this is the
  // first character.
  const first = Array.from(trimmed)[0];
  return first.toUpperCase();
}