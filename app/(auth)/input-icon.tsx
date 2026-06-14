import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Wraps the shadcn Input with a leading icon (mail/lock/user per the mockup)
// instead of forking the primitive. Server Component — no interactivity.
function InputIcon({
  icon,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { icon: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <Input className={cn("h-[42px] pl-9 bg-card", className)} {...props} />
    </div>
  );
}

export { InputIcon };
