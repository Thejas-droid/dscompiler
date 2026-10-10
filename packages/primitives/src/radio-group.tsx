import * as React from "react";
import { useControllableState } from "./shared.js";

type Ctx = { value?: string; setValue: (value: string) => void; name?: string; disabled?: boolean };
const Context = React.createContext<Ctx | null>(null);
export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> { value?: string; defaultValue?: string; onValueChange?: (value: string) => void; name?: string; disabled?: boolean; orientation?: "horizontal" | "vertical"; }
export function RadioGroup({ value, defaultValue = "", onValueChange, name, disabled, orientation = "vertical", ...props }: RadioGroupProps) {
  const [current, setCurrent] = useControllableState(value, defaultValue, onValueChange);
  return <Context.Provider value={{ value: current, setValue: setCurrent, ...(name ? { name } : {}), ...(disabled !== undefined ? { disabled } : {}) }}><div {...props} role="radiogroup" aria-orientation={orientation} onKeyDown={(e) => { props.onKeyDown?.(e); if (e.defaultPrevented || !["ArrowRight","ArrowDown","ArrowLeft","ArrowUp","Home","End"].includes(e.key)) return; const radios=[...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])')]; if (!radios.length) return; const active=Math.max(0,radios.indexOf(document.activeElement as HTMLElement)); const next=e.key==="Home"?0:e.key==="End"?radios.length-1:e.key==="ArrowRight"||e.key==="ArrowDown"?(active+1)%radios.length:(active-1+radios.length)%radios.length; e.preventDefault(); radios[next]?.focus(); radios[next]?.click(); }}>{props.children}</div></Context.Provider>;
}
export interface RadioItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { value: string }
export const RadioItem = React.forwardRef<HTMLButtonElement, RadioItemProps>(function RadioItem({ value, ...props }, ref) {
  const ctx = React.useContext(Context); if (!ctx) throw new Error("RadioItem must be inside RadioGroup");
  const checked = ctx.value === value; const disabled = ctx.disabled || props.disabled;
  return <button {...props} ref={ref} type="button" role="radio" aria-checked={checked} aria-disabled={disabled || undefined} tabIndex={checked ? 0 : -1} data-state={checked ? "checked" : "unchecked"} onClick={(e) => { props.onClick?.(e); if (!e.defaultPrevented && !disabled) ctx.setValue(value); }} />;
});
