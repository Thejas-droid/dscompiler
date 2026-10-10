import * as React from "react";

const paths: Record<string, React.ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
      <path d="M9 21v-8h6v8" />
    </>
  ),
  palette: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="8" cy="9" r="1" />
      <circle cx="13" cy="7" r="1" />
      <circle cx="17" cy="11" r="1" />
      <path d="M9 20c-1-4 3-5 5-3" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 10 5-10 5L2 8Z" />
      <path d="m2 12 10 5 10-5M2 16l10 5 10-5" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  check: (
    <>
      <path d="m8 12 3 3 5-6" />
      <rect x="3" y="3" width="18" height="18" rx="5" />
    </>
  ),
  arrow: (
    <>
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M15 8V3H3v12h5" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 6 6" />
    </>
  ),
  code: (
    <>
      <path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16" />
    </>
  ),
  terminal: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="m6 9 3 3-3 3m6 0h6" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7a9 9 0 1 0 1 8M20 2v6h-6" />
    </>
  ),
  moon: <path d="M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" />
    </>
  ),
  book: (
    <>
      <path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v1" />
    </>
  ),
};
export function Icon({ name, size = 19 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.code}
    </svg>
  );
}
export function CopyButton({
  text,
  label = "Copy",
  compact = false,
}: {
  text: string;
  label?: string;
  compact?: boolean;
}) {
  const [state, setState] = React.useState<"idle" | "copied" | "error">("idle");
  React.useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 2600);
    return () => window.clearTimeout(timer);
  }, [state]);
  return (
    <span className="copy-wrap">
      <button
        type="button"
        className={`copy-button ${compact ? "compact" : ""}`}
        aria-label={label}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setState("copied");
          } catch {
            setState("error");
          }
        }}
      >
        <Icon name={state === "copied" ? "check" : "copy"} size={15} />
        {compact ? (
          <span className="sr-only">{label}</span>
        ) : state === "copied" ? (
          "Copied"
        ) : (
          label
        )}
      </button>
      <span
        className={`copy-feedback ${state === "error" ? "copy-error" : ""}`}
        role="status"
      >
        {state === "copied" && compact
          ? "Copied"
          : state === "error"
            ? "Copy unavailable. Select the text to copy."
            : ""}
      </span>
    </span>
  );
}
export function CodeBlock({
  code,
  label = "Terminal",
  copyLabel,
}: {
  code: string;
  label?: string;
  copyLabel?: string;
}) {
  return (
    <div className="code-block">
      <div className="code-heading">
        <span>
          <Icon name={label === "Terminal" ? "terminal" : "code"} size={15} />
          {label}
        </span>
        <CopyButton
          text={code}
          label={copyLabel ?? `Copy ${label.toLowerCase()}`}
          compact
        />
      </div>
      <pre tabIndex={0} role="region" aria-label={`${label} code`}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="note">
      <Icon name="info" size={18} />
      <div>{children}</div>
    </div>
  );
}
