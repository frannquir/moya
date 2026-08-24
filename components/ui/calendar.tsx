"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames, type DayPickerProps } from "react-day-picker";
import { es } from "react-day-picker/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * shadcn's Calendar, hand-written rather than pulled from the registry: the CLI
 * wanted to overwrite this project's button.tsx to install it, and the registry
 * template still targets react-day-picker v9 while this project is on v10. The
 * slot names below come from v10's own getDefaultClassNames().
 *
 * Spanish by default — locale is the firm's, and the weekday initials and month
 * names are the only text this renders.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: DayPickerProps) {
  const defaults = getDefaultClassNames();

  return (
    <DayPicker
      locale={es}
      showOutsideDays={showOutsideDays}
      className={cn("p-2", className)}
      classNames={{
        ...defaults,
        root: cn(defaults.root, "w-fit"),
        months: cn(defaults.months, "flex flex-col gap-3"),
        month: cn(defaults.month, "flex flex-col gap-3"),
        month_caption: cn(
          defaults.month_caption,
          "flex h-8 items-center justify-center px-8",
        ),
        // The month name arrives lowercase from the es locale.
        caption_label: cn(defaults.caption_label, "text-sm font-medium capitalize"),
        nav: cn(defaults.nav, "flex items-center justify-between absolute inset-x-2"),
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 opacity-60 hover:opacity-100",
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 opacity-60 hover:opacity-100",
        ),
        month_grid: cn(defaults.month_grid, "w-full border-collapse"),
        weekdays: cn(defaults.weekdays, "flex"),
        weekday: cn(
          defaults.weekday,
          "w-9 text-[0.7rem] font-normal text-muted-foreground capitalize",
        ),
        week: cn(defaults.week, "flex w-full mt-1"),
        day: cn(defaults.day, "size-9 p-0 text-center text-sm"),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-9 p-0 font-normal aria-selected:opacity-100",
        ),
        selected: cn(
          defaults.selected,
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
        ),
        today: cn(defaults.today, "[&>button]:bg-accent [&>button]:text-accent-foreground"),
        outside: cn(defaults.outside, "text-muted-foreground/50"),
        disabled: cn(defaults.disabled, "text-muted-foreground/50"),
        hidden: cn(defaults.hidden, "invisible"),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" {...rest} />
          ) : (
            <ChevronRight className="size-4" {...rest} />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
