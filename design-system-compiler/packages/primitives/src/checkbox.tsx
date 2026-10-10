import * as React from "react";
import { useControllableState } from "./shared.js";

export interface CheckboxProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> { checked?: boolean; defaultChecked?: boolean; onCheckedChange?: (checked: boolean) => void; }
export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox({ checked, defaultChecked = false, onCheckedChange, children, ...props }, ref) {
  const [value, setValue] = useControllableState(checked, defaultChecked, onCheckedChange);
  return <button {...props} ref={ref} type="button" role="checkbox" aria-checked={value} data-state={value ? "checked" : "unchecked"} onClick={(e) => { props.onClick?.(e); if (!e.defaultPrevented && !props.disabled) setValue(!value); }}>{children}</button>;
});
