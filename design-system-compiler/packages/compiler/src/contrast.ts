import { DiagnosticBag } from "./diagnostics.js";
import type { ResolvedTheme, TokenNode, TokenValue } from "./types.js";

export interface ContrastPairResult {
  theme: string;
  foreground: string;
  background: string;
  ratio?: number;
  required: number;
  ok: boolean;
}

export function analyzeContrast(
  tokens: Map<string, TokenNode>,
  themes: Map<string, ResolvedTheme>,
  pairs: Array<[string, string, number?]>
): { results: ContrastPairResult[]; diagnostics: DiagnosticBag } {
  const diagnostics = new DiagnosticBag();
  const results: ContrastPairResult[] = [];
  const contexts = new Map<string, Map<string, TokenValue>>();
  const base = new Map<string, TokenValue>();
  for (const [name, token] of tokens) if (token.resolvedValue !== undefined) base.set(name, token.resolvedValue);
  contexts.set("base", base);
  for (const [name, theme] of themes) contexts.set(name, theme.values);

  for (const [themeName, values] of contexts) {
    for (const [foreground, background, threshold = 4.5] of pairs) {
      const fg = values.get(foreground);
      const bg = values.get(background);
      const ratio = typeof fg === "string" && typeof bg === "string" ? contrastRatio(fg, bg) : undefined;
      const ok = ratio === undefined ? true : ratio >= threshold;
      results.push({ theme: themeName, foreground, background, required: threshold, ok, ...(ratio !== undefined ? { ratio } : {}) });
      if (ratio !== undefined && !ok) {
        diagnostics.error("CONTRAST_FAILURE", `Contrast ${ratio.toFixed(2)}:1 is below ${threshold}:1.`, {
          token: `${foreground} vs ${background}`,
          details: [`Theme: ${themeName}`, `Foreground: ${String(fg)}`, `Background: ${String(bg)}`]
        });
      }
    }
  }
  return { results, diagnostics };
}

export function contrastRatio(a: string, b: string): number | undefined {
  const rgbA = parseColor(a);
  const rgbB = parseColor(b);
  if (!rgbA || !rgbB) return undefined;
  const l1 = luminance(rgbA);
  const l2 = luminance(rgbB);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function parseColor(value: string): [number, number, number] | undefined {
  const hex = value.trim().match(/^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i);
  if (hex?.[1]) {
    let body = hex[1];
    if (body.length === 3) body = body.split("").map((c) => c + c).join("");
    return [parseInt(body.slice(0, 2), 16), parseInt(body.slice(2, 4), 16), parseInt(body.slice(4, 6), 16)];
  }
  const rgb = value.trim().match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return undefined;
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
