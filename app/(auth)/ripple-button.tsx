"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Primary submit button with the mockup's press ripple: on pointerdown we set
// --rx/--ry CSS vars so the ::after radial gradient originates at the cursor.
// CSS-only otherwise; the keyframes/ripple respect prefers-reduced-motion via
// the .auth-ripple styles in this file's consumer (globals are not touched).
function RippleButton({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--rx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--ry", `${e.clientY - rect.top}px`);
  }

  return (
    <Button
      onPointerDown={handlePointerDown}
      className={cn("auth-ripple", className)}
      {...props}
    >
      {children}
    </Button>
  );
}

export { RippleButton };
