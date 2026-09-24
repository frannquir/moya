"use client";

import { useRef, useTransition } from "react";
import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MovimientoBadge } from "@/components/movimiento-badge";
import { MOVIMIENTO_OPTIONS } from "@/lib/domain/ejecutado";
import { cn } from "@/lib/utils";

const DILIGENCIADA_OPTIONS = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
  { value: "__unknown__", label: "Sin dato" },
] as const;

function diligenciadaValueOf(diligenciada: boolean | null): string {
  return diligenciada === true ? "si" : diligenciada === false ? "no" : "__unknown__";
}

/**
 * The badge, made interactive (feature 7): stage and diligenciada are one
 * fact (MovimientoBadge already renders them together), so both live in one
 * menu and change through one Server Action. A real <button> trigger with a
 * chevron and a focus ring — the whole complaint was a colour chip that
 * looked pressable and wasn't.
 *
 * Submits through a hidden <form> rather than calling the action directly
 * (gotcha #14: Server Actions need POST) — a RadioGroup selection writes the
 * next values into the form's hidden inputs, then requestSubmit()s it.
 */
export function MovimientoDropdown({
  movimiento,
  diligenciada,
  action,
}: {
  movimiento: string | null;
  diligenciada: boolean | null;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const movimientoRef = useRef<HTMLInputElement>(null);
  const diligenciadaRef = useRef<HTMLInputElement>(null);

  const diligenciadaValue = diligenciadaValueOf(diligenciada);

  function submitWith(nextMovimiento: string, nextDiligenciada: string) {
    if (movimientoRef.current) movimientoRef.current.value = nextMovimiento;
    if (diligenciadaRef.current) diligenciadaRef.current.value = nextDiligenciada;
    startTransition(() => {
      formRef.current?.requestSubmit();
    });
  }

  return (
    <>
      <form ref={formRef} action={action} className="hidden">
        <input
          ref={movimientoRef}
          type="hidden"
          name="movimiento"
          defaultValue={movimiento ?? "__none__"}
        />
        <input
          ref={diligenciadaRef}
          type="hidden"
          name="movimiento_diligenciada"
          defaultValue={diligenciadaValue}
        />
      </form>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={isPending}
            className={cn(
              "group inline-flex items-center gap-1 rounded-full outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            <MovimientoBadge
              movimiento={movimiento}
              diligenciada={diligenciada}
              className="pointer-events-none transition-[filter] group-hover:brightness-95"
            />
            <ChevronDown
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Movimiento</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={movimiento ?? "__none__"}
            onValueChange={(next) => submitWith(next, diligenciadaValue)}
          >
            <DropdownMenuRadioItem value="__none__">
              <span className="text-muted-foreground">Sin movimiento</span>
            </DropdownMenuRadioItem>
            {MOVIMIENTO_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option} value={option}>
                <MovimientoBadge movimiento={option} className="pointer-events-none" />
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />

          <DropdownMenuLabel>Diligenciado</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={diligenciadaValue}
            onValueChange={(next) => submitWith(movimiento ?? "__none__", next)}
          >
            {DILIGENCIADA_OPTIONS.map((opt) => (
              <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                {opt.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
