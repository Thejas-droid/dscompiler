export const TOKEN_TYPES = [
  "color", "dimension", "number", "fontFamily", "fontWeight", "fontSize",
  "lineHeight", "letterSpacing", "duration", "cubicBezier", "shadow", "border",
  "gradient", "opacity"
] as const;

export type TokenType = (typeof TOKEN_TYPES)[number];
export type TokenPrimitive = string | number | boolean | null;
export type TokenValue = TokenPrimitive | TokenPrimitive[] | Record<string, unknown>;

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}

export interface DeprecationInfo {
  message?: string;
  replacement?: string;
  since?: string;
}

export interface TokenNode {
  path: string;
  type: TokenType;
  value: TokenValue;
  rawValue: TokenValue;
  resolvedValue?: TokenValue;
  description?: string;
  deprecated?: boolean | DeprecationInfo;
  since?: string;
  tags?: string[];
  source: SourceLocation;
  references: string[];
  sourceKind?: "primitive" | "semantic" | "theme" | "unknown";
}

export type DiagnosticSeverity = "error" | "warning" | "info";
export type DiagnosticCode =
  | "TOKEN_FILE_INVALID"
  | "TOKEN_SCHEMA_INVALID"
  | "TOKEN_REFERENCE_MISSING"
  | "TOKEN_CYCLE"
  | "TOKEN_TYPE_MISMATCH"
  | "THEME_CYCLE"
  | "THEME_MISSING_TOKEN"
  | "THEME_UNKNOWN_TOKEN"
  | "COMPONENT_NOT_FOUND"
  | "COMPONENT_DEPENDENCY_CYCLE"
  | "CODEMOD_PARSE_FAILED"
  | "MANUAL_MIGRATION_REQUIRED"
  | "VISUAL_REGRESSION"
  | "A11Y_FAILURE"
  | "CONTRAST_FAILURE"
  | "DEPRECATED_TOKEN"
  | "PRIMITIVE_TOKEN_IN_COMPONENT"
  | "UNKNOWN_COMPONENT_DEPENDENCY";

export interface Diagnostic {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  message: string;
  source?: SourceLocation;
  token?: string;
  details?: string[];
  suggestion?: string;
}

export interface ThemeDefinition {
  name: string;
  extends?: string;
  file: string;
  overrides: Map<string, Partial<TokenNode> & Pick<TokenNode, "path" | "value" | "rawValue" | "references" | "source">>;
}

export interface ResolvedTheme {
  name: string;
  extends?: string;
  values: Map<string, TokenValue>;
  overrides: Set<string>;
  rawOverrides: Map<string, TokenValue>;
}

export interface CssConfig {
  prefix?: string;
  separator?: string;
  splitByCategory?: boolean;
}

export interface DocsConfig { enabled?: boolean }

export interface CompilerConfig {
  tokens: string[];
  themes?: string;
  registry?: string;
  outDir?: string;
  css?: CssConfig;
  docs?: DocsConfig;
  contrastPairs?: Array<[string, string, number?]>;
}

export interface TokenMetadata {
  name: string;
  type: TokenType;
  value: TokenValue;
  resolvedValue: TokenValue;
  reference?: string;
  references: string[];
  cssVariable: string;
  description?: string;
  since?: string;
  deprecated?: boolean | DeprecationInfo;
  tags?: string[];
  source: SourceLocation;
  sourceKind?: TokenNode["sourceKind"];
  themes?: Record<string, TokenValue>;
}

export interface GeneratedArtifact {
  path: string;
  content: string;
  kind: "css" | "typescript" | "json" | "docs" | "schema";
}


export interface GeneratorContext {
  tokens: Map<string, TokenNode>;
  themes: Map<string, ResolvedTheme>;
  config: CompilerConfig;
  metadata: TokenMetadata[];
}

export interface Generator {
  name: string;
  version?: string;
  generate(context: GeneratorContext): GeneratedArtifact[] | Promise<GeneratedArtifact[]>;
}

export interface CompileResult {
  tokens: Map<string, TokenNode>;
  themes: Map<string, ResolvedTheme>;
  diagnostics: Diagnostic[];
  artifacts: GeneratedArtifact[];
  metadata: TokenMetadata[];
  inputHash: string;
  durationMs: number;
  cacheHit: boolean;
}

export interface ComponentManifest {
  name: string;
  version: string;
  description?: string;
  files: string[];
  dependencies?: string[];
  registryDependencies?: string[];
  tokens?: string[];
  requires?: Record<string, string>;
  accessibility?: {
    keyboard?: string[];
    notes?: string[];
  };
}

export interface RegistryItem {
  manifest: ComponentManifest;
  directory: string;
}

export interface InstalledComponentState {
  version: string;
  files: Record<string, string>;
}

export interface RegistryState {
  registry: string;
  components: Record<string, InstalledComponentState>;
}

export interface DiffEntry {
  kind: "added" | "changed" | "removed" | "deprecated";
  name: string;
  before?: unknown;
  after?: unknown;
}
