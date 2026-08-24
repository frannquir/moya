"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  FECHA_AR_PLACEHOLDER,
  formatFechaAr,
  maskFechaAr,
  parseFechaAr,
} from "@/lib/domain/fecha-ar";

/**
 * A date field the lawyer can TYPE or PASTE, with a calendar as the fallback.
 *
 * Replaces `<input type="date">`, which rendered in the browser's locale — the
 * same field read dd/mm/aaaa on one machine and mm/dd/yyyy on another, which is
 * a silent way to file 09/12 as September 12 — and which fights you if you try
 * to paste into it.
 *
 * The visible input carries NO `name`. What posts is the hidden input holding
 * ISO `yyyy-mm-dd`, because every server parser reads the raw form value
 * straight into a Postgres DATE column and that contract does not change.
 *
 * Controlled (`value` + `onValueChange`, both ISO) or uncontrolled
 * (`defaultValue`), because the two callers differ: the demanda form drives a
 * localStorage draft, while the ejecutado form is a plain uncontrolled form.
 */
export function DateField({
  id,
  name,
  value,
  defaultValue,
  onValueChange,
  required,
  disabled,
  className,
  min,
  max,
}: {
  id?: string;
  name: string;
  /** ISO yyyy-mm-dd. Presence of this prop makes the field controlled. */
  value?: string;
  /** ISO yyyy-mm-dd, uncontrolled callers only. */
  defaultValue?: string | null;
  onValueChange?: (iso: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** ISO bounds for the calendar. */
  min?: string;
  max?: string;
}) {
  const controlled = value !== undefined;
  const [innerIso, setInnerIso] = React.useState(defaultValue ?? "");
  const iso = controlled ? value : innerIso;

  // What is in the box. Kept separate from `iso` because a half-typed "09/12"
  // is a legitimate state that has no ISO value yet, and re-deriving the text
  // from `iso` on every keystroke would erase it as you type.
  const [text, setText] = React.useState(() => formatFechaAr(iso));
  const [open, setOpen] = React.useState(false);

  // Follow the value when the OWNER changes it - a restored localStorage draft,
  // a form reset - without clobbering what is being typed. React's documented
  // "adjusting state when a prop changes" shape: compare against the last value
  // rendered, held in state rather than a ref so this is a legal render-phase
  // update rather than a mutation React cannot see.
  const [lastIso, setLastIso] = React.useState(iso);
  if (iso !== lastIso) {
    setLastIso(iso);
    // Only rewrite the box if it does not already say this date, so a keystroke
    // that produced `iso` in the first place never round-trips through here.
    if (parseFechaAr(text) !== iso) setText(formatFechaAr(iso));
  }

  const commit = (nextIso: string) => {
    setLastIso(nextIso);
    if (!controlled) setInnerIso(nextIso);
    onValueChange?.(nextIso);
  };

  const onChange = (raw: string) => {
    const masked = maskFechaAr(raw);
    setText(masked);
    // Empty clears the value; anything unparseable leaves the last good ISO
    // alone until blur, so deleting one digit mid-edit does not wipe the field.
    if (masked === "") commit("");
    else {
      const parsed = parseFechaAr(masked);
      if (parsed) commit(parsed);
    }
  };

  // On blur the box is reconciled with the value: a complete date is reformatted
  // canonically, and leftover junk is discarded rather than left looking saved.
  const onBlur = () => {
    const parsed = parseFechaAr(text);
    if (parsed) {
      commit(parsed);
      setText(formatFechaAr(parsed));
    } else if (text.trim() === "") {
      commit("");
    } else {
      setText(formatFechaAr(iso));
    }
  };

  const selected = iso ? isoToLocalDate(iso) : undefined;
  const invalid = text.trim() !== "" && parseFechaAr(text) === null;

  return (
    <div className={cn("relative", className)}>
      {/* The value that actually posts. */}
      <input type="hidden" name={name} value={iso} />

      <Input
        id={id}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={FECHA_AR_PLACEHOLDER}
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        aria-invalid={invalid || undefined}
        // `required` cannot sit on the hidden input - a hidden required field
        // blocks submit with an unfocusable element and no message.
        required={required && iso === "" ? true : undefined}
        className="pr-10"
      />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label="Abrir calendario"
            className="absolute right-0 top-0 h-full w-9 text-muted-foreground hover:text-foreground"
          >
            <CalendarIcon className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            startMonth={min ? isoToLocalDate(min) : undefined}
            endMonth={max ? isoToLocalDate(max) : undefined}
            onSelect={(date) => {
              if (!date) return;
              const nextIso = localDateToIso(date);
              commit(nextIso);
              setText(formatFechaAr(nextIso));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Local, never UTC: `new Date("2026-03-20")` is parsed as midnight UTC and comes
// back as the 19th anywhere west of Greenwich - which is all of Argentina.
function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function localDateToIso(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
