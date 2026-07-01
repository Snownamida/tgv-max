const FLAGS: Record<string, string> = {
  FR: "🇫🇷",
  DE: "🇩🇪",
  CH: "🇨🇭",
  ES: "🇪🇸",
  IT: "🇮🇹",
  BE: "🇧🇪",
  LU: "🇱🇺",
};

/** Emoji flag for an ISO country prefix, or empty string if unknown. */
export const flag = (country: string): string => FLAGS[country] ?? "";
