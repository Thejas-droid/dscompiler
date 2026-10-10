import * as React from "react";
import { useControllableState } from "./shared.js";
export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> { checked?: boolean; defaultChecked?: boolean; onCheckedChange?: (checked: boolean) => void; }
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(function Switch({ checked, defaultChecked = false, onCheckedChange, ...props }, ref) {
  const [value, setValue] = useControllableState(checked, defaultChecked, onCheckedChange);
  return <button {...props} ref={ref} type="button" role="switch" aria-checked={value} data-state={value ? "checked" : "unchecked"} onClick={(e) => { props.onClick?.(e); if (!e.defaultPrevented && !props.disabled) setValue(!value); }} />;
});
