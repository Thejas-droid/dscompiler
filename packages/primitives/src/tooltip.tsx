import * as React from "react";

type Ctx = {
  open: boolean;
  setOpen: (value: boolean) => void;
  id: string;
  delay: number;
  timer: React.MutableRefObject<number | undefined>;
};
const Context = React.createContext<Ctx | null>(null);

export function TooltipRoot({ children, delay = 300 }: { children: React.ReactNode; delay?: number }) {
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);
  const id = React.useId();
  React.useEffect(() => () => window.clearTimeout(timer.current), []);
  return <Context.Provider value={{ open, setOpen, id, delay, timer }}>{children}</Context.Provider>;
}

type TriggerElementProps = React.HTMLAttributes<HTMLElement> & React.RefAttributes<HTMLElement>;
type TooltipTriggerProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactElement<TriggerElementProps>;
};

export const TooltipTrigger = React.forwardRef<HTMLElement, TooltipTriggerProps>(function TooltipTrigger({ children, ...props }, ref) {
  const ctx = React.useContext(Context);
  if (!ctx) throw new Error("TooltipTrigger must be inside TooltipRoot");
  const show = () => {
    window.clearTimeout(ctx.timer.current);
    ctx.timer.current = window.setTimeout(() => ctx.setOpen(true), ctx.delay);
  };
  const hide = () => {
    window.clearTimeout(ctx.timer.current);
    ctx.setOpen(false);
  };
  return React.cloneElement(children, {
    ...props,
    ...children.props,
    ref,
    "aria-describedby": ctx.open ? ctx.id : undefined,
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
      props.onMouseEnter?.(event);
      children.props.onMouseEnter?.(event);
      show();
    },
    onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
      props.onMouseLeave?.(event);
      children.props.onMouseLeave?.(event);
      hide();
    },
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      props.onFocus?.(event);
      children.props.onFocus?.(event);
      show();
    },
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      props.onBlur?.(event);
      children.props.onBlur?.(event);
      hide();
    }
  });
});

export const TooltipContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function TooltipContent(props, ref) {
  const ctx = React.useContext(Context);
  if (!ctx?.open) return null;
  return <div {...props} ref={ref} id={ctx.id} role="tooltip" data-state="open" />;
});
