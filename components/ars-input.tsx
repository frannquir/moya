"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  digitsBefore,
  formatMonedaAr,
  maskMonedaAr,
  offsetAfterDigits,
  parseMonedaAr,
} from "@/lib/domain/moneda-ar";

/**
 * A peso field: shows "$ 1.234.567,89", posts a plain "1234567.89".
 *
 * `type="text"` — a number input cannot render thousands separators. Same shape
 * as `components/cuil-input.tsx`: the visible input carries no `name`, the
 * hidden sibling posts the clean value.
 */
export function ArsInput({
  id,
  name,
  value,
  defaultValue,
  onValueChange,
  required,
  disabled,
  placeholder = "0,00",
  className,
  min,
}: {
  id?: string;
  name: string;
  /** Controlled: the numeric value. */
  value?: number | null;
  /** Uncontrolled initial value. */
  defaultValue?: number | string | null;
  onValueChange?: (value: number | null) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Rejected below this on blur; only used to stop negatives where they make no sense. */
  min?: number;
}) {
  const controlled = value !== undefined;
  const initial =
    defaultValue === null || defaultValue === undefined || defaultValue === ""
      ? null
      : typeof defaultValue === "number"
        ? defaultValue
        : parseMonedaAr(String(defaultValue));

  const [innerValue, setInnerValue] = React.useState<number | null>(initial);
  const current = controlled ? (value ?? null) : innerValue;

  const [text, setText] = React.useState(() => formatMonedaAr(current));
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Set during onChange, applied after the masked value is painted.
  const caretDigits = React.useRef<number | null>(null);

  // Follow the owner on a reset or a restored draft, but not while the box
  // already says this number, or typing fights the sync.
  const [lastValue, setLastValue] = React.useState(current);
  if (current !== lastValue) {
    setLastValue(current);
    if (parseMonedaAr(text) !== current) setText(formatMonedaAr(current));
  }

  // Masking rewrites the string and would throw the caret to the end. Restored
  // by digit count, not offset: the number of separators changes as you type.
  React.useLayoutEffect(() => {
    const n = caretDigits.current;
    if (n === null || !inputRef.current) return;
    caretDigits.current = null;
    const at = offsetAfterDigits(inputRef.current.value, n);
    inputRef.current.setSelectionRange(at, at);
  });

  const commit = (next: number | null) => {
    setLastValue(next);
    if (!controlled) setInnerValue(next);
    onValueChange?.(next);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const before = digitsBefore(raw, e.target.selectionStart ?? raw.length);
    const masked = maskMonedaAr(raw);
    caretDigits.current = before;
    setText(masked);
    if (masked === "") commit(null);
    else {
      const parsed = parseMonedaAr(masked);
      if (parsed !== null) commit(parsed);
    }
  };

  // Settles to two decimals here; per keystroke it would rewrite "1.234," under
  // the cursor.
  const onBlur = () => {
    const parsed = parseMonedaAr(text);
    if (text.trim() === "") {
      commit(null);
      setText("");
      return;
    }
    if (parsed === null || (min !== undefined && parsed < min)) {
      setText(formatMonedaAr(current));
      return;
    }
    commit(parsed);
    setText(formatMonedaAr(parsed));
  };

  const invalid = text.trim() !== "" && parseMonedaAr(text) === null;

  return (
    <div className={cn("relative", className)}>
      {/* Posts a plain numeric string. */}
      <input type="hidden" name={name} value={current === null ? "" : String(current)} />

      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
      >
        $
      </span>
      <Input
        ref={inputRef}
        id={id}
        value={text}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        aria-invalid={invalid || undefined}
        // Never on the hidden input: that blocks submit with no focusable target.
        required={required && current === null ? true : undefined}
        className="pl-7 text-right tabular-nums"
      />
    </div>
  );
}
