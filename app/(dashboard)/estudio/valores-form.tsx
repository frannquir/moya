"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArsInput } from "@/components/ars-input";
import { DateField } from "@/components/date-field";
import { formatArDate } from "@/lib/domain/dates";
import { formatArs } from "@/lib/domain/honorarios";
import {
  MONTHS_ES,
  parseTasasBlock,
  type TasaFields,
  type TasaRowFull,
} from "@/lib/domain/liquidaciones";
import { guardarJus, guardarTasas, type ValoresState } from "./actions";

const EMPTY: ValoresState = { ok: null, error: null };

/**
 * The JUS value. Every peso figure derived from a honorario reads this, and it
 * had no UI at all — it was seeded in May 2026 and still held that number in
 * September, so the ARS a lawyer saw on a honorario was five months stale.
 */
export function JusForm({
  value,
  date,
  updatedAt,
  stale,
}: {
  value: number;
  date: string | null;
  updatedAt: string | null;
  /** Computed on the server: reading the clock during render is not idempotent. */
  stale: boolean;
}) {
  const [state, action, pending] = useActionState(guardarJus, EMPTY);
  const [next, setNext] = useState<number | null>(value || null);

  return (
    <form action={action} className="space-y-4">
      <div className="text-sm">
        <span className="text-muted-foreground">Valor actual: </span>
        <span className="font-medium tabular-nums">{formatArs(value)}</span>
        {date && (
          <span className="text-muted-foreground">
            {" "}
            · vigente desde {formatArDate(date)}
          </span>
        )}
      </div>

      {stale && updatedAt && (
        <Alert>
          <AlertDescription>
            No se actualiza desde {formatArDate(updatedAt.slice(0, 10))}. Revisá el
            valor publicado por el Colegio.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="jus_value">Nuevo valor</Label>
          <ArsInput
            id="jus_value"
            name="jus_value"
            min={0}
            required
            value={next}
            onValueChange={setNext}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jus_date">Vigente desde</Label>
          <DateField
            id="jus_date"
            name="jus_date"
            defaultValue={date ?? new Date().toISOString().slice(0, 10)}
          />
        </div>
      </div>

      <Feedback state={state} />

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Actualizar JUS"}
      </Button>
    </form>
  );
}

const CAMPOS_VACIOS: TasaFields = {
  mes: "",
  anio: "",
  tna: "",
  intsPunitorios: "",
  tea: "",
  cft: "",
};

const clave = (r: { anio: number; mes: string }) => `${r.anio}-${r.mes}`;

const camposDe = (r: TasaRowFull): TasaFields => ({
  mes: r.mes,
  anio: String(r.anio),
  tna: String(r.tna),
  intsPunitorios: r.intsPunitorios === null ? "" : String(r.intsPunitorios),
  tea: r.tea === null ? "" : String(r.tea),
  cft: r.cft === null ? "" : String(r.cft),
});

/**
 * The BCRA monthly rates, one row of six fields — the shape of the table they
 * are copied from:
 *
 *   MES     AÑO   Fin. Saldos  Ints. Punitorios  T.E.A.     C.F.T.
 *   JUNIO   2025  90.5200      45.2600           109.5292   109.5292
 *
 * Pasting that line into any field fills all six, because retyping six numbers
 * off a web page is how a digit gets transposed. A multi-month paste keeps the
 * first row in the fields, where it stays editable, and lists the rest.
 *
 * The last month loaded is stated up front: calcularLiquidacion() clamps to it
 * instead of failing, so a gap here quietly under-calculates interest on every
 * liquidación that runs past it.
 */
export function TasasForm({ ultima }: { ultima: TasaRowFull | null }) {
  const [state, action, pending] = useActionState(guardarTasas, EMPTY);
  const [campos, setCampos] = useState<TasaFields>(CAMPOS_VACIOS);
  // Rows 2..n of a multi-line paste, kept as the raw text so the server parses
  // the same characters the preview did instead of trusting a list from here.
  const [bloque, setBloque] = useState("");
  const [extras, setExtras] = useState<TasaRowFull[]>([]);
  // Which pasted row the editable fields stand for, so editing it replaces that
  // row instead of adding a seventh month.
  const [reemplaza, setReemplaza] = useState("");

  const set = (k: keyof TasaFields) => (v: string) =>
    setCampos((c) => ({ ...c, [k]: v }));

  // One handler on every field: a line pasted into the T.E.A. box was still
  // meant as a whole line.
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const texto = e.clipboardData.getData("text");
    const { parsed } = parseTasasBlock(texto);
    // Not a BCRA row — a lone number, say. Let the browser paste it normally.
    if (parsed.length === 0) return;

    e.preventDefault();
    setCampos(camposDe(parsed[0]));
    setReemplaza(clave(parsed[0]));
    setExtras(parsed.slice(1));
    setBloque(parsed.length > 1 ? texto : "");
  };

  const limpiarExtras = () => {
    setExtras([]);
    setBloque("");
  };

  const total = 1 + extras.length;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="bloque" value={bloque} />
      <input type="hidden" name="reemplaza" value={reemplaza} />

      <div className="text-sm">
        <span className="text-muted-foreground">Último mes cargado: </span>
        <span className="font-medium">
          {ultima ? `${ultima.mes} ${ultima.anio}` : "ninguno"}
        </span>
      </div>

      {/* Container-relative: this card can sit in a narrow column, and six
          fields on one row only work once there is room for them. */}
      <div className="@container">
        <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-6">
          <Campo
            label="Mes"
            name="mes"
            value={campos.mes}
            onChange={set("mes")}
            onPaste={onPaste}
            list="meses-es"
            placeholder="JUNIO"
            required
          />
          <Campo
            label="Año"
            name="anio"
            value={campos.anio}
            onChange={set("anio")}
            onPaste={onPaste}
            placeholder="2025"
            required
          />
          <Campo
            label="Fin. Saldos"
            hint="Financiación de saldos (TNA). Es la que usa la liquidación."
            name="tna"
            value={campos.tna}
            onChange={set("tna")}
            onPaste={onPaste}
            placeholder="90,5200"
            required
          />
          <Campo
            label="Ints. Punitorios"
            hint="La mitad de la financiación (Ley 25.065)."
            name="ints_punitorios"
            value={campos.intsPunitorios}
            onChange={set("intsPunitorios")}
            onPaste={onPaste}
            placeholder="45,2600"
          />
          <Campo
            label="T.E.A."
            hint="Tasa efectiva anual."
            name="tea"
            value={campos.tea}
            onChange={set("tea")}
            onPaste={onPaste}
            placeholder="109,5292"
          />
          <Campo
            label="C.F.T."
            hint="Costo financiero total."
            name="cft"
            value={campos.cft}
            onChange={set("cft")}
            onPaste={onPaste}
            placeholder="109,5292"
          />
        </div>
      </div>

      <datalist id="meses-es">
        {MONTHS_ES.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      <p className="text-xs text-muted-foreground">
        Pegá la línea del BCRA en cualquier campo y se reparte sola. La liquidación
        usa Fin. Saldos; los otros tres quedan registrados.
      </p>

      {extras.length > 0 && (
        <div className="rounded-md border">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs uppercase text-muted-foreground">
              Y {extras.length} {extras.length === 1 ? "mes más" : "meses más"} del
              pegado
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={limpiarExtras}>
              Quitar
            </Button>
          </div>
          <ul className="divide-y text-sm">
            {extras.map((t) => (
              <li key={clave(t)} className="flex justify-between gap-3 px-3 py-1.5">
                <span>
                  {t.mes} {t.anio}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {[t.tna, t.intsPunitorios, t.tea, t.cft]
                    .filter((n) => n !== null)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Feedback state={state} />

      <Button type="submit" disabled={pending}>
        {pending
          ? "Guardando…"
          : total === 1
            ? "Guardar mes"
            : `Guardar ${total} meses`}
      </Button>
    </form>
  );
}

function Campo({
  label,
  hint,
  name,
  value,
  onChange,
  onPaste,
  placeholder,
  list,
  required,
}: {
  label: string;
  hint?: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  list?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`tasa_${name}`} className="text-xs" title={hint}>
        {label}
      </Label>
      <Input
        id={`tasa_${name}`}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        placeholder={placeholder}
        list={list}
        required={required}
        autoComplete="off"
        // text, not number: these arrive as "90.5200 " with a trailing space or
        // as "90,5200", neither of which a number input will hold.
        inputMode="decimal"
        className="tabular-nums"
      />
    </div>
  );
}

function Feedback({ state }: { state: ValoresState }) {
  if (!state.ok && !state.error) return null;
  return (
    <Alert variant={state.error ? "destructive" : "default"}>
      <AlertDescription>{state.error ?? state.ok}</AlertDescription>
    </Alert>
  );
}
