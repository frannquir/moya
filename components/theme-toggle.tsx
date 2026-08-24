"use client";

import * as React from "react";
import { Moon, Sun, Monitor, Check } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

/**
 * Three states, not a two-way switch: "Sistema" is the default and a real
 * choice, so a binary toggle could not express it — and once the OS is set to
 * dark at night, "follow the OS" is the setting most people actually want.
 *
 * The trigger renders both icons and crossfades them with CSS rather than
 * branching on `theme`. Branching would need the mounted guard below to gate the
 * whole button, which makes it pop in on every page load.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // `theme` is undefined until after hydration, because the server cannot know
  // what the browser resolved. Only the CHECKMARK depends on it, so only the
  // checkmark waits — the button itself renders identically on both sides.
  //
  // useSyncExternalStore rather than a setState-in-effect: the store never
  // changes (the subscribe callback is a no-op), the client snapshot is true and
  // the server snapshot false, which is exactly "have we hydrated yet" without
  // the cascading render an effect would cause.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Cambiar tema">
          <Sun className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
            <Icon className="mr-2 size-4" />
            {label}
            {mounted && theme === value && <Check className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
