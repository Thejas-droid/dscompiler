import * as React from "react";
import * as D from "@dsc/primitives";
import { Button } from "./button";
import "./dialog.css";
export const Dialog={Root:D.DialogRoot,Trigger:D.DialogTrigger,Portal:D.DialogPortal,Overlay:(p:React.ComponentProps<typeof D.DialogOverlay>)=><D.DialogOverlay {...p} className={["ds-dialog-overlay",p.className].filter(Boolean).join(" ")}/>,Content:(p:React.ComponentProps<typeof D.DialogContent>)=><D.DialogContent {...p} className={["ds-dialog-content",p.className].filter(Boolean).join(" ")}/>,Title:(p:React.ComponentProps<typeof D.DialogTitle>)=><D.DialogTitle {...p} className={["ds-dialog-title",p.className].filter(Boolean).join(" ")}/>,Description:(p:React.ComponentProps<typeof D.DialogDescription>)=><D.DialogDescription {...p} className={["ds-dialog-description",p.className].filter(Boolean).join(" ")}/>,Close:D.DialogClose,Button};
