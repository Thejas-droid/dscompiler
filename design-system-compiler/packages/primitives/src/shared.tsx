import * as React from "react";

export function useControllableState<T>(controlled: T | undefined, defaultValue: T, onChange?: (value: T) => void): [T, (value: T | ((prev: T) => T)) => void] {
  const [internal, setInternal] = React.useState(defaultValue);
  const value = controlled === undefined ? internal : controlled;
  const setValue = React.useCallback((next: T | ((prev: T) => T)) => {
    const resolved = typeof next === "function" ? (next as (prev: T) => T)(value) : next;
    if (controlled === undefined) setInternal(resolved);
    onChange?.(resolved);
  }, [controlled, onChange, value]);
  return [value, setValue];
}

export function composeEventHandlers<E extends { defaultPrevented: boolean }>(theirs: ((event: E) => void) | undefined, ours: (event: E) => void): (event: E) => void {
  return (event) => { theirs?.(event); if (!event.defaultPrevented) ours(event); };
}

export function focusable(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true");
}

export function useFocusTrap(active: boolean, ref: React.RefObject<HTMLElement | null>, onEscape?: () => void): void {
  React.useEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const targets = focusable(root);
    (targets[0] ?? root).focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onEscape?.(); return; }
      if (event.key !== "Tab") return;
      const current = focusable(root);
      if (!current.length) { event.preventDefault(); root.focus(); return; }
      const first = current[0] as HTMLElement;
      const last = current[current.length - 1] as HTMLElement;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [active, onEscape, ref]);
}

export const Slot = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & { children: React.ReactElement }>(function Slot({ children, ...props }, forwardedRef) {
  const child = children as React.ReactElement<any>;
  const childProps = child.props as Record<string, any>;
  const childRef = (child as any).ref as React.Ref<HTMLElement> | undefined;
  const ref = (node: HTMLElement | null) => {
    assignRef(forwardedRef, node);
    assignRef(childRef, node);
  };
  return React.cloneElement(child, { ...props, ...childProps, ref, className: [props.className, childProps.className].filter(Boolean).join(" ") });
});
function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null): void {
  if (typeof ref === "function") ref(value);
  else if (ref && typeof ref === "object") (ref as React.MutableRefObject<T | null>).current = value;
}
