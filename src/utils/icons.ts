// §14.4 icon resolution.
//
// MVP ships PNG icons at `/icons/{iconKey}.png`. When the file is missing
// the template shows a colored badge with a short unique label (see
// `BADGE_TEXT` below) instead of nothing — that way every tab is
// recognisable even before assets ship. When a real PNG is dropped into
// `public/icons/{iconKey}.png`, the badge gets covered and acts as a
// placeholder while the image loads.

const SUPPORTED_FORMATS = ["png", "svg"] as const;

export type IconFormat = (typeof SUPPORTED_FORMATS)[number];

export interface ResolvedIcon {
  src: string;
  format: IconFormat;
}

/**
 * Per-provider brand palette used as the badge background when no
 * PNG/SVG is shipped. Picks distinct hues so five tabs in a row are
 * recognisable at a glance — and avoids two providers sharing a single
 * first-letter monogram (Qwen and Claude both start with letters that
 * would collide with naive monograms).
 */
export const BADGE_BG: Readonly<Record<string, string>> = {
  qwen: "#FF6A00",     // Alibaba orange
  chatgpt: "#10A37F",   // OpenAI green
  claude: "#D97757",    // Anthropic warm orange
  gemini: "#4285F4",    // Google blue
  grok: "#1A1A1A",      // X / Grok near-black
};

/** Text color on top of `BADGE_BG`. White for all current providers;
 *  kept separate so dark-mode providers (if any) can opt for light text. */
export const BADGE_FG: Readonly<Record<string, string>> = {
  qwen: "#FFFFFF",
  chatgpt: "#FFFFFF",
  claude: "#FFFFFF",
  gemini: "#FFFFFF",
  grok: "#FFFFFF",
};

/**
 * 2-character labels rendered inside the fallback badge. Picked so
 * no two providers share a label — first-letter monograms collide
 * (ChatGPT and Claude both start with C, Gemini and Grok with G).
 */
export const BADGE_TEXT: Readonly<Record<string, string>> = {
  qwen: "Qw",
  chatgpt: "GP",
  claude: "Cl",
  gemini: "Gm",
  grok: "Gk",
};

/**
 * Resolve an `iconKey` to a public path. Tries PNG first, then SVG.
 * Returns `null` only for inputs that fail the iconKey regex; the
 * template is responsible for the fallback when the file 404s (see
 * `TabBar.vue`).
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
 * Background color for the fallback badge. Falls back to surface-3
 * (neutral) for unknown icon keys.
 */
export function iconBrandBg(iconKey: string): string {
  return BADGE_BG[iconKey] ?? "var(--color-surface-3)";
}

/**
 * Foreground (text) color for the fallback badge.
 */
export function iconBrandFg(iconKey: string): string {
  return BADGE_FG[iconKey] ?? "var(--color-ink)";
}

/**
 * Label text rendered inside the fallback badge. Uses the
 * per-provider map when available, otherwise falls back to the first
 * two characters of the iconKey uppercased.
 */
export function iconFallbackLabel(iconKey: string): string {
  return BADGE_TEXT[iconKey] ?? iconKey.slice(0, 2).toUpperCase();
}
