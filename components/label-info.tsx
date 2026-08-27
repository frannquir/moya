"use client";

import * as React from "react";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ayudaDe } from "@/lib/domain/campo-ayuda";

/**
 * A field label with an "i" that explains it on hover, in place of a permanent
 * grey paragraph under every input.
 *
 * The trigger is a real `<button type="button">`, not a span: it opens on
 * keyboard focus too, and these sit inside forms where a bare <button> would
 * default to type="submit" and save the case.
 *
 * Touch has no hover, and Radix closes tooltips on pointerdown, so a tap would
 * open via focus and immediately close. The handler below intercepts pointerdown
 * for `pointerType === "touch"` only; mouse and keyboard stay on Radix's path.
 */
export function LabelConInfo({
  htmlFor,
  campo,
  children,
  className,
}: {
  htmlFor?: string;
  /** Key into CAMPO_AYUDA. An unknown key renders a plain label. */
  campo: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ayuda = ayudaDe(campo);
  const [open, setOpen] = React.useState(false);

  if (!ayuda) {
    return (
      <Label htmlFor={htmlFor} className={className}>
        {children}
      </Label>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Label htmlFor={htmlFor}>{children}</Label>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Qué significa ${ayuda.titulo}`}
            onPointerDown={(e) => {
              if (e.pointerType !== "touch") return;
              // Radix's close-on-pointerdown would undo the open focus causes.
              e.preventDefault();
              setOpen((v) => !v);
            }}
            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        {/* Sized for one line of chrome text (inline-flex,
            items-center, max-w-xs). An explanation is a short paragraph, so it
            needs to stack and breathe. */}
        <TooltipContent
          side="top"
          align="start"
          sideOffset={6}
          className="block max-w-[19rem] px-3 py-2 text-xs leading-relaxed"
        >
          {ayuda.texto}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
