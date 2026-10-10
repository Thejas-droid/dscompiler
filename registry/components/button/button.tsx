import * as React from "react";
import { Button as PrimitiveButton, type ButtonProps as PrimitiveButtonProps } from "@dsc/primitives";
import "./button.css";
export interface ButtonProps extends PrimitiveButtonProps { variant?: "primary"|"secondary"|"ghost"|"danger"; size?: "sm"|"md"|"lg" }
export const Button=React.forwardRef<HTMLButtonElement,ButtonProps>(function Button({variant="primary",size="md",className,...props},ref){return <PrimitiveButton ref={ref} className={["ds-button",`ds-button--${variant}`,`ds-button--${size}`,className].filter(Boolean).join(" ")} {...props}/>});
