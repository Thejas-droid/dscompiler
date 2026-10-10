import type { ButtonHTMLAttributes } from "react";
export interface ButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "style" | "className"
> {
  variant?: "primary" | "secondary";
}
export function Button({
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`care-button care-button-${variant}`}
    />
  );
}
