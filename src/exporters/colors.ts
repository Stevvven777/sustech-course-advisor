export function courseColorCss(code: string): string {
  return `hsl(${courseHue(code)} 58% 78%)`;
}

export function courseColorArgb(code: string): string {
  const [red, green, blue] = hslToRgb(courseHue(code), 0.58, 0.78);
  return `FF${hex(red)}${hex(green)}${hex(blue)}`;
}

function courseHue(code: string): number {
  let hash = 2166136261;
  for (const char of code.trim().toUpperCase()) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.round(((((hash >>> 0) % 997) * 137.508) % 360) * 10) / 10;
}

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const chroma = (1 - Math.abs((2 * lightness) - 1)) * saturation;
  const section = hue / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  const [red, green, blue] = section < 1 ? [chroma, secondary, 0]
    : section < 2 ? [secondary, chroma, 0]
      : section < 3 ? [0, chroma, secondary]
        : section < 4 ? [0, secondary, chroma]
          : section < 5 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  const match = lightness - (chroma / 2);
  return [red, green, blue].map((value) => Math.round((value + match) * 255)) as [number, number, number];
}

function hex(value: number): string { return value.toString(16).padStart(2, "0").toUpperCase(); }
