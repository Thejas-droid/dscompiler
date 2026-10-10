import * as React from "react";
import { Slot } from "./shared.js";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { asChild?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({ asChild, type = "button", ...props }, ref) {
  if (asChild && React.isValidElement(props.children)) return <Slot ref={ref as React.Ref<HTMLElement>} {...(props as React.HTMLAttributes<HTMLElement>)}>{props.children}</Slot>;
  return <button ref={ref} type={type} {...props} />;
});
