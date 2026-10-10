import * as React from "react";
import * as P from "@dsc/primitives";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export interface ButtonProps extends P.ButtonProps { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant="primary", size="md", className, ...props }, ref) {
  return <P.Button ref={ref} className={["ds-button", `ds-button--${variant}`, `ds-button--${size}`, className].filter(Boolean).join(" ")} {...props}/>;
});

export const Checkbox = React.forwardRef<HTMLButtonElement, P.CheckboxProps>(function Checkbox({className,children,...props},ref){return <P.Checkbox ref={ref} className={["ds-checkbox",className].filter(Boolean).join(" ")} {...props}>{children??<span aria-hidden="true" className="ds-checkbox__indicator">✓</span>}</P.Checkbox>});
export const Switch = React.forwardRef<HTMLButtonElement, P.SwitchProps>(function Switch({className,...props},ref){return <P.Switch ref={ref} className={["ds-switch",className].filter(Boolean).join(" ")} {...props}><span className="ds-switch__thumb"/></P.Switch>});

export const Dialog = {
  Root: P.DialogRoot,
  Trigger: P.DialogTrigger,
  Portal: P.DialogPortal,
  Overlay: React.forwardRef<HTMLDivElement,React.ComponentPropsWithoutRef<typeof P.DialogOverlay>>(function Overlay({className,...props},ref){return <P.DialogOverlay ref={ref} className={["ds-dialog-overlay",className].filter(Boolean).join(" ")} {...props}/>} ),
  Content: React.forwardRef<HTMLDivElement,React.ComponentPropsWithoutRef<typeof P.DialogContent>>(function Content({className,...props},ref){return <P.DialogContent ref={ref} className={["ds-dialog-content",className].filter(Boolean).join(" ")} {...props}/>} ),
  Title: React.forwardRef<HTMLHeadingElement,React.ComponentPropsWithoutRef<typeof P.DialogTitle>>(function Title({className,...props},ref){return <P.DialogTitle ref={ref} className={["ds-dialog-title",className].filter(Boolean).join(" ")} {...props}/>} ),
  Description: React.forwardRef<HTMLParagraphElement,React.ComponentPropsWithoutRef<typeof P.DialogDescription>>(function Description({className,...props},ref){return <P.DialogDescription ref={ref} className={["ds-dialog-description",className].filter(Boolean).join(" ")} {...props}/>} ),
  Close: P.DialogClose
};

export const Tabs = {
  Root: P.TabsRoot,
  List: React.forwardRef<HTMLDivElement,React.ComponentPropsWithoutRef<typeof P.TabsList>>(function List({className,...props},ref){return <P.TabsList ref={ref} className={["ds-tabs-list",className].filter(Boolean).join(" ")} {...props}/>} ),
  Trigger: React.forwardRef<HTMLButtonElement,React.ComponentPropsWithoutRef<typeof P.TabsTrigger>>(function Trigger({className,...props},ref){return <P.TabsTrigger ref={ref} className={["ds-tabs-trigger",className].filter(Boolean).join(" ")} {...props}/>} ),
  Content: React.forwardRef<HTMLDivElement,React.ComponentPropsWithoutRef<typeof P.TabsContent>>(function Content({className,...props},ref){return <P.TabsContent ref={ref} className={["ds-tabs-content",className].filter(Boolean).join(" ")} {...props}/>} )
};

export const Accordion = { Root:P.AccordionRoot, Item:P.AccordionItem, Trigger:P.AccordionTrigger, Content:P.AccordionContent };
export const Popover = { Root:P.PopoverRoot, Trigger:P.PopoverTrigger, Content:P.PopoverContent };
export const Tooltip = { Root:P.TooltipRoot, Trigger:P.TooltipTrigger, Content:P.TooltipContent };
export const DropdownMenu = { Root:P.DropdownMenuRoot, Trigger:P.DropdownMenuTrigger, Content:P.DropdownMenuContent, Item:P.DropdownMenuItem };
export const Select = { Root:P.SelectRoot, Trigger:P.SelectTrigger, Content:P.SelectContent, Item:P.SelectItem };
export const RadioGroup = P.RadioGroup;
export const RadioItem = P.RadioItem;
export const ToastProvider = P.ToastProvider;
export const ToastViewport = P.ToastViewport;
export const useToast = P.useToast;
export const Combobox = P.Combobox;
