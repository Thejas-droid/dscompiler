import type * as React from "react";

export type Token = {
  name: string;
  type: string;
  resolvedValue: unknown;
  value?: unknown;
  cssVariable: string;
  description?: string;
  deprecated?: boolean | { message?: string; replacement?: string };
  themes?: Record<string, unknown>;
  reference?: string;
  sourceKind?: string;
  source?: { file: string; line: number; column: number };
};
export type Component = {
  name: string;
  version: string;
  description?: string;
  tokens?: string[];
  files?: string[];
  accessibility?: { keyboard?: string[]; notes?: string[] };
};
export type Page = "start" | "tokens" | "themes" | "components" | "testing";
export const pages: {
  id: Page;
  label: string;
  icon: string;
  subtitle: string;
}[] = [
  {
    id: "start",
    label: "Start here",
    icon: "home",
    subtitle: "Your design system, explained",
  },
  {
    id: "tokens",
    label: "Design tokens",
    icon: "palette",
    subtitle: "Explore the values behind your UI",
  },
  {
    id: "themes",
    label: "Themes",
    icon: "layers",
    subtitle: "One system. Different appearances.",
  },
  {
    id: "components",
    label: "Components",
    icon: "grid",
    subtitle: "Try the building blocks",
  },
  {
    id: "testing",
    label: "How to test",
    icon: "check",
    subtitle: "Make a change with confidence",
  },
];
export function formatValue(value: unknown): string {
  return typeof value === "object" && value !== null
    ? JSON.stringify(value)
    : String(value ?? "");
}
export function themeValue(token: Token, theme: string): unknown {
  return token.themes?.[theme] ?? token.resolvedValue;
}
export function themeStyle(
  tokens: Token[],
  theme: string,
): React.CSSProperties {
  return Object.fromEntries(
    tokens.map((token) => [
      token.cssVariable,
      Array.isArray(themeValue(token, theme)) && token.type === "cubicBezier"
        ? `cubic-bezier(${(themeValue(token, theme) as number[]).join(", ")})`
        : formatValue(themeValue(token, theme)),
    ]),
  );
}
export function prettyName(value: string): string {
  return value
    .split(/[-.]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
