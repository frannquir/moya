"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cuilDigits, cuilToDni, formatCuil, formatDni, isValidCuil } from "@/lib/domain/cuil";
import { cn } from "@/lib/utils";

/**
 * CUIL/CUIT field: masks as the user types and flags a bad check digit before
 * submit. Works controlled (pass value + onValueChange, as the demanda form does
 * so its draft autosaves) or uncontrolled (pass defaultValue, as the edit form
 * does). `showDni` prints the DNI the CUIL resolves to, which is what gets stored
 * in ejecutados.documento.
 */
export function CuilInput({
  id,
  name,
  defaultValue = "",
  value,
  onValueChange,
  placeholder = "20-12345678-6",
  showDni = false,
  className,
  required,
}: {
  id?: string;
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (next: string) => void;
  placeholder?: string;
  showDni?: boolean;
  className?: string;
  required?: boolean;
}) {
  const [inner, setInner] = useState(() => formatCuil(defaultValue));
  const current = value === undefined ? inner : formatCuil(value);

  const handle = (raw: string) => {
    const next = formatCuil(raw);
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };

  // Only complain once the number is long enough to judge; complaining while the
  // user is still on the fourth digit is noise.
  const complete = cuilDigits(current).length === 11;
  const invalid = complete && !isValidCuil(current);
  const dni = complete && !invalid ? cuilToDni(current) : "";

  return (
    <div className="space-y-1">
      <Input
        id={id}
        name={name}
        value={current}
        onChange={(e) => handle(e.target.value)}
        placeholder={placeholder}
        inputMode="numeric"
        autoComplete="off"
        required={required}
        aria-invalid={invalid || undefined}
        className={cn(invalid && "border-destructive focus-visible:ring-destructive/40", className)}
      />
      {invalid && (
        <p className="text-xs text-destructive">
          El dígito verificador no coincide. Revisá el número.
        </p>
      )}
      {!invalid && showDni && dni !== "" && (
        <p className="text-xs text-muted-foreground">D.N.I. {formatDni(dni)}</p>
      )}
    </div>
  );
}
