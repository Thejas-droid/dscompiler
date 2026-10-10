import type { CompilerConfig, TokenType, SourceLocation } from "@dsc/compiler";
export const RULES = [
  "DS_RAW_STYLE",
  "DS_UNKNOWN_TOKEN",
  "DS_TOKEN_TYPE",
  "DS_TOKEN_SCOPE",
  "DS_DEPRECATED_TOKEN",
  "DS_UNAPPROVED_COMPONENT",
  "DS_RESTRICTED_PROP",
  "DS_INVALID_VARIANT",
  "DS_UNSUPPORTED_SOURCE",
  "DS_SOURCE_PARSE_ERROR",
] as const;
export type Rule = (typeof RULES)[number];
export type Severity = "error" | "warning";
export interface ComponentRule {
  from: string;
  name: string;
  replaces?: string[];
  variants?: Record<string, string[]>;
  forbidProps?: string[];
}
export interface Contract {
  version: 1;
  name: string;
  properties: Record<
    string,
    { types: TokenType[]; tokens?: string[]; allow?: Array<string | number> }
  >;
  components?: ComponentRule[];
  implementation?: string[];
  forbiddenImports?: string[];
  rules?: Partial<Record<Rule, Severity | "off">>;
  exceptions?: Array<{
    files: string[];
    rules: Rule[];
    reason: string;
    expires: string;
  }>;
}
export interface EnforcementDiagnostic {
  code: string;
  severity: Severity;
  message: string;
  source?: SourceLocation;
  suggestion?: string;
}
export interface InspectionReport {
  schemaVersion: 1;
  contractHash: string;
  contractName: string;
  mode: "warn" | "strict";
  ready: boolean;
  passed: boolean;
  diagnostics: EnforcementDiagnostic[];
  suppressed: Array<
    EnforcementDiagnostic & { reason: string; expires: string }
  >;
  coverage: { scanned: string[]; excluded: string[]; unsupported: string[] };
}
export interface InspectionOptions {
  cwd?: string;
  config?: string;
  mode?: "warn" | "strict";
  failOnWarnings?: boolean;
  emit?: boolean;
  now?: Date;
}
export type EnforcementConfig = NonNullable<CompilerConfig["enforcement"]>;
