import ts from "typescript";
import postcss from "postcss";
import valueParser, { type Node as ValueNode } from "postcss-value-parser";
import type { TokenMetadata, SourceLocation } from "@dsc/compiler";
import { matches } from "./contract.js";
import type {
  ComponentRule,
  Contract,
  EnforcementDiagnostic,
  Rule,
} from "./types.js";

export interface ScanResult {
  diagnostics: EnforcementDiagnostic[];
  unsupported: boolean;
}
export function scanSource(
  file: string,
  text: string,
  contract: Contract,
  tokens: TokenMetadata[],
  prefix = "ds",
  separator = "-",
): ScanResult {
  const diagnostics: EnforcementDiagnostic[] = [];
  const byVariable = new Map(tokens.map((t) => [t.cssVariable, t]));
  let unsupported = false;
  const emit = (
    code: Rule,
    message: string,
    source: SourceLocation,
    suggestion?: string,
  ) => {
    if (code === "DS_UNSUPPORTED_SOURCE") unsupported = true;
    const setting =
      contract.rules?.[code] ??
      (code === "DS_UNSUPPORTED_SOURCE" ? "warning" : "error");
    if (setting !== "off")
      diagnostics.push({
        code,
        severity: setting,
        message,
        source,
        ...(suggestion ? { suggestion } : {}),
      });
  };
  const location = (offset: number): SourceLocation => {
    const lines = text.slice(0, offset).split(/\r?\n/);
    return {
      file,
      line: lines.length,
      column: (lines.at(-1)?.length ?? 0) + 1,
    };
  };
  function value(
    property: string,
    input: string | number,
    source: SourceLocation,
  ) {
    const rule = contract.properties[property];
    const raw = String(input).trim();
    const allowed = new Set((rule?.allow ?? []).map(String));
    if (property.startsWith(`--${prefix}${separator}`)) {
      emit(
        byVariable.has(property) ? "DS_RESTRICTED_PROP" : "DS_UNKNOWN_TOKEN",
        `Consumer source must not define or override design-system variable ${property}.`,
        source,
        "Change the approved token definition, or use a reviewed contract exception.",
      );
    }
    let approved = 0;
    const unknown = new Set<string>();
    const residual: string[] = [];
    const collect = (nodes: ValueNode[]) => {
      for (const node of nodes) {
        if (node.type === "function" && node.value.toLowerCase() === "var") {
          const reference =
            valueParser.stringify(node.nodes).split(",")[0]?.trim() ?? "";
          const token = byVariable.get(reference);
          if (token) {
            approved++;
            if (rule?.tokens && !matches(token.name, rule.tokens))
              emit(
                "DS_TOKEN_SCOPE",
                `${reference} is not an approved semantic token for ${property}.`,
                source,
                `Allowed token patterns: ${rule.tokens.join(", ")}.`,
              );
            if (token.deprecated)
              emit(
                "DS_DEPRECATED_TOKEN",
                `${reference} is deprecated.`,
                source,
                typeof token.deprecated === "object" &&
                  token.deprecated.replacement
                  ? `Use ${token.deprecated.replacement}.`
                  : "Choose an approved replacement token.",
              );
            if (rule && !rule.types.includes(token.type))
              emit(
                "DS_TOKEN_TYPE",
                `${reference} is a ${token.type} token, which is not allowed for ${property}.`,
                source,
                `Use a token of type ${rule.types.join(" or ")}.`,
              );
          } else {
            if (reference.startsWith(`--${prefix}${separator}`))
              unknown.add(reference);
            residual.push(`var(${reference})`);
          }
          const comma = node.nodes.findIndex(
            (n) => n.type === "div" && n.value === ",",
          );
          if (comma >= 0) collect(node.nodes.slice(comma + 1));
        } else if (
          node.type === "function" &&
          ["calc", "min", "max", "clamp"].includes(node.value.toLowerCase())
        ) {
          collect(node.nodes);
        } else if (node.type === "function") {
          // Unknown functions still contain token references that must be checked.
          // Keep the whole expression as residual so it needs explicit approval.
          collect(node.nodes);
          residual.push(valueParser.stringify(node));
        } else if (node.type === "word" || node.type === "string") {
          if (!["+", "-", "*", "/"].includes(node.value))
            residual.push(
              node.type === "string" ? valueParser.stringify(node) : node.value,
            );
        }
      }
    };
    collect(valueParser(raw).nodes);
    for (const reference of unknown)
      emit(
        "DS_UNKNOWN_TOKEN",
        `${reference} is not defined in the approved design system.`,
        source,
        "Use an existing named token or add a reviewed token definition.",
      );
    if (
      rule &&
      !allowed.has(raw) &&
      (approved === 0 || residual.some((part) => !allowed.has(part)))
    ) {
      emit(
        "DS_RAW_STYLE",
        `Value ${JSON.stringify(raw)} for ${property} is outside the approved token contract.`,
        source,
        `Use an approved ${rule.types.join(" or ")} token via var(--${prefix}-…), or an explicitly allowed value. No semantic replacement was inferred.`,
      );
    }
  }
  if (/\.css$/i.test(file)) {
    try {
      const root = postcss.parse(text, { from: file });
      root.walkDecls((decl) =>
        value(decl.prop, decl.value, {
          file,
          line: decl.source?.start?.line ?? 1,
          column: decl.source?.start?.column ?? 1,
        }),
      );
      root.walkAtRules((at) => {
        if (
          ["apply", "tailwind", "use", "mixin", "include", "function"].includes(
            at.name,
          )
        )
          emit(
            "DS_UNSUPPORTED_SOURCE",
            `@${at.name} needs a styling adapter; only plain CSS is supported.`,
            location(at.source?.start?.offset ?? 0),
          );
      });
    } catch (error) {
      const e = error as { reason?: string; line?: number; column?: number };
      emit(
        "DS_SOURCE_PARSE_ERROR",
        `CSS could not be parsed: ${e.reason ?? String(error)}`,
        { file, line: e.line ?? 1, column: e.column ?? 1 },
      );
    }
  } else if (/\.[cm]?[jt]sx?$/i.test(file)) {
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      /x$/i.test(file)
        ? ts.ScriptKind.TSX
        : /\.m?jsx?$/i.test(file)
          ? ts.ScriptKind.JS
          : ts.ScriptKind.TS,
    );
    const parseErrors = (
      source as ts.SourceFile & { parseDiagnostics: ts.Diagnostic[] }
    ).parseDiagnostics;
    for (const error of parseErrors)
      emit(
        "DS_SOURCE_PARSE_ERROR",
        ts.flattenDiagnosticMessageText(error.messageText, " "),
        location(error.start ?? 0),
      );
    const imports = new Map<string, ComponentRule>();
    const namespaces = new Map<string, string>();
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      )
        continue;
      const from = statement.moduleSpecifier.text;
      if (matches(from, contract.forbiddenImports ?? []))
        emit(
          "DS_UNAPPROVED_COMPONENT",
          `Import from ${JSON.stringify(from)} is forbidden by the approved contract.`,
          location(statement.getStart(source)),
          "Use the approved component module.",
        );
      if (/styled-components|@emotion\//.test(from))
        emit(
          "DS_UNSUPPORTED_SOURCE",
          `Styles from ${from} require a CSS-in-JS adapter.`,
          location(statement.getStart(source)),
        );
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings))
        for (const binding of bindings.elements) {
          const rule = contract.components?.find(
            (c) =>
              c.from === from &&
              c.name === (binding.propertyName?.text ?? binding.name.text),
          );
          if (rule) imports.set(binding.name.text, rule);
        }
      if (bindings && ts.isNamespaceImport(bindings))
        namespaces.set(bindings.name.text, from);
      if (statement.importClause?.name) {
        const rule = contract.components?.find(
          (c) => c.from === from && c.name === "default",
        );
        if (rule) imports.set(statement.importClause.name.text, rule);
      }
    }
    const unwrap = (expression: ts.Expression): ts.Expression => {
      while (
        ts.isParenthesizedExpression(expression) ||
        ts.isAsExpression(expression) ||
        ts.isSatisfiesExpression(expression) ||
        ts.isTypeAssertionExpression(expression)
      )
        expression = expression.expression;
      return expression;
    };
    const literal = (
      expression: ts.Expression,
    ): string | number | undefined => {
      expression = unwrap(expression);
      if (ts.isStringLiteralLike(expression)) return expression.text;
      if (ts.isNumericLiteral(expression)) return Number(expression.text);
      if (
        ts.isPrefixUnaryExpression(expression) &&
        expression.operator === ts.SyntaxKind.MinusToken &&
        ts.isNumericLiteral(expression.operand)
      )
        return -Number(expression.operand.text);
      return undefined;
    };
    function inline(expression: ts.Expression) {
      expression = unwrap(expression);
      if (!ts.isObjectLiteralExpression(expression)) {
        emit(
          "DS_UNSUPPORTED_SOURCE",
          "Dynamic or referenced style object cannot be statically verified.",
          location(expression.getStart(source)),
          "Use a literal token-based object or move styles to a checked CSS file.",
        );
        return;
      }
      for (const prop of expression.properties) {
        if (
          !ts.isPropertyAssignment(prop) ||
          ts.isComputedPropertyName(prop.name)
        ) {
          emit(
            "DS_UNSUPPORTED_SOURCE",
            "Spread, computed or shorthand style property cannot be statically verified.",
            location(prop.getStart(source)),
          );
          continue;
        }
        const name =
          ts.isIdentifier(prop.name) || ts.isStringLiteralLike(prop.name)
            ? prop.name.text
            : prop.name.getText(source);
        const property = name.startsWith("--")
          ? name
          : name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
        const val = literal(prop.initializer);
        if (val !== undefined)
          value(property, val, location(prop.getStart(source)));
        else
          emit(
            "DS_UNSUPPORTED_SOURCE",
            `Dynamic style value for ${property} cannot be statically verified.`,
            location(prop.getStart(source)),
          );
      }
    }
    function visit(node: ts.Node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(source);
        const parts = tag.split(".");
        const rule =
          imports.get(tag) ??
          contract.components?.find(
            (c) =>
              parts.length === 2 &&
              namespaces.get(parts[0]!) === c.from &&
              c.name === parts[1],
          );
        const replacement = contract.components?.find((c) =>
          c.replaces?.includes(tag),
        );
        if (replacement)
          emit(
            "DS_UNAPPROVED_COMPONENT",
            `<${tag}> must use approved ${replacement.name} from ${replacement.from}.`,
            location(node.getStart(source)),
            `Import and use ${replacement.name}; structural HTML and custom compositions remain allowed.`,
          );
        for (const attr of node.attributes.properties) {
          if (ts.isJsxSpreadAttribute(attr)) {
            emit(
              "DS_UNSUPPORTED_SOURCE",
              `Spread props on ${rule ? `approved ${rule.name}` : `<${tag}>`} cannot be checked for style overrides, restricted props or variants.`,
              location(attr.getStart(source)),
            );
            continue;
          }
          const name = attr.name.getText(source);
          if (rule?.forbidProps?.includes(name))
            emit(
              "DS_RESTRICTED_PROP",
              `${name} overrides are forbidden on approved ${rule.name}.`,
              location(attr.getStart(source)),
              "Use a supported variant or a reviewed component change.",
            );
          const expression =
            attr.initializer && ts.isJsxExpression(attr.initializer)
              ? attr.initializer.expression
              : undefined;
          if (name === "style") {
            if (expression) inline(expression);
            else if (attr.initializer)
              emit(
                "DS_UNSUPPORTED_SOURCE",
                "Only literal object JSX styles are supported.",
                location(attr.getStart(source)),
              );
          }
          if (rule?.variants?.[name]) {
            const val =
              attr.initializer && ts.isStringLiteral(attr.initializer)
                ? attr.initializer.text
                : expression
                  ? literal(expression)
                  : undefined;
            if (val === undefined)
              emit(
                "DS_UNSUPPORTED_SOURCE",
                `Dynamic ${name} on ${rule.name} cannot be verified.`,
                location(attr.getStart(source)),
              );
            else if (!rule.variants[name]!.includes(String(val)))
              emit(
                "DS_INVALID_VARIANT",
                `${JSON.stringify(val)} is not an approved ${name} for ${rule.name}.`,
                location(attr.getStart(source)),
                `Allowed values: ${rule.variants[name]!.join(", ")}.`,
              );
          }
        }
      }
      if (
        ts.isCallExpression(node) &&
        /(^|\.)createElement$/.test(node.expression.getText(source))
      )
        emit(
          "DS_UNSUPPORTED_SOURCE",
          "createElement calls need a component/style adapter; use checked JSX.",
          location(node.getStart(source)),
        );
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        /\.style(?:\.|\[|$)/.test(node.left.getText(source))
      )
        emit(
          "DS_UNSUPPORTED_SOURCE",
          "Runtime DOM style mutation is outside static JSX/CSS coverage.",
          location(node.getStart(source)),
        );
      if (
        ts.isCallExpression(node) &&
        (/\.style\.(?:setProperty|removeProperty)$/.test(
          node.expression.getText(source),
        ) ||
          (/\.setAttribute$/.test(node.expression.getText(source)) &&
            node.arguments[0] &&
            literal(node.arguments[0]) === "style"))
      )
        emit(
          "DS_UNSUPPORTED_SOURCE",
          "Runtime DOM style mutation is outside static JSX/CSS coverage.",
          location(node.getStart(source)),
        );
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        if (
          node.attributes.properties.some(
            (a) =>
              ts.isJsxAttribute(a) &&
              a.name.getText(source) === "dangerouslySetInnerHTML",
          )
        )
          emit(
            "DS_UNSUPPORTED_SOURCE",
            "Injected HTML and its styles are outside static JSX/CSS coverage.",
            location(node.getStart(source)),
          );
      }
      if (
        ts.isTaggedTemplateExpression(node) &&
        /^(css|styled)(\.|\(|$)/.test(node.tag.getText(source))
      )
        emit(
          "DS_UNSUPPORTED_SOURCE",
          "CSS-in-JS template needs a styling adapter.",
          location(node.getStart(source)),
        );
      ts.forEachChild(node, visit);
    }
    visit(source);
  } else {
    emit(
      "DS_UNSUPPORTED_SOURCE",
      `No source adapter for ${file}.`,
      { file, line: 1, column: 1 },
      "Use React/JSX/TSX and plain CSS, add an adapter, or declare a reviewed exclusion.",
    );
  }
  return { diagnostics, unsupported };
}
