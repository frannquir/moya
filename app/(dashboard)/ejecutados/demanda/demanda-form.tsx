"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PartyFieldsBlock } from "@/components/party-fields";
import { JuzgadoPicker } from "../juzgado-picker";
import {
  emptyParty,
  labelForCodemandado,
  onlyDigits,
  validateParty,
  type PartyFields,
} from "@/lib/domain/demanda";
import { type CourtEntry } from "@/lib/data/juzgados";
import { createDemanda, type DemandaState } from "./actions";

const NONE = "__none__";

type Draft = {
  demandado: PartyFields;
  codemandados: PartyFields[];
  cuenta_cliper: string;
  fecha_contrato: string;
  deuda_inicial: string;
  numero_expediente: string;
  empresa: string;
};

function emptyDraft(): Draft {
  return {
    demandado: emptyParty(),
    codemandados: [],
    cuenta_cliper: "",
    fecha_contrato: "",
    deuda_inicial: "",
    numero_expediente: "",
    empresa: NONE,
  };
}

// A draft that is still completely blank is not worth announcing on restore.
function isBlank(d: Draft): boolean {
  return (
    d.demandado.nombre === "" &&
    d.demandado.cuil === "" &&
    d.codemandados.length === 0 &&
    d.cuenta_cliper === "" &&
    d.deuda_inicial === "" &&
    d.numero_expediente === ""
  );
}

export function DemandaForm({
  userId,
  courtIndex,
  empresas,
}: {
  userId: string;
  courtIndex: CourtEntry[];
  empresas: string[];
}) {
  const [state, formAction] = useActionState<DemandaState, FormData>(createDemanda, null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [restored, setRestored] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  // Nothing is persisted until the mount-time read has run, otherwise the blank
  // initial state would overwrite the draft we are about to restore.
  const hydrated = useRef(false);

  // Keyed per user so two accounts on the same machine never see each other's work.
  const storageKey = `moya:demanda-draft:${userId}`;

  const persist = useCallback(
    (value: Draft) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(value));
      } catch {
        // Private mode / quota. Autosave is a convenience, never a hard failure.
      }
    },
    [storageKey],
  );

  const discard = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setDraft(emptyDraft());
    setRestored(false);
  }, [storageKey]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = { ...emptyDraft(), ...(JSON.parse(raw) as Partial<Draft>) };
        if (!isBlank(parsed)) {
          // Restoring a draft is unavoidably a post-mount setState: localStorage
          // does not exist during SSR, and seeding useState from it would desync
          // hydration. Runs once per key, so it cannot cascade.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setDraft(parsed);
          setRestored(true);
        }
      }
    } catch {
      // A corrupt draft is discarded rather than blocking the form.
    }
    hydrated.current = true;
  }, [storageKey]);

  // Debounced: typing a name should not write to localStorage on every keystroke.
  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => persist(draft), 400);
    return () => clearTimeout(t);
  }, [draft, persist]);

  // The action redirects on success, so it only ever returns when it rejected the
  // submission. Put the draft back, since submitting cleared it.
  useEffect(() => {
    if (state?.error) persist(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const setDemandado = (next: PartyFields) => setDraft((d) => ({ ...d, demandado: next }));
  const setCodemandado = (i: number, next: PartyFields) =>
    setDraft((d) => ({
      ...d,
      codemandados: d.codemandados.map((c, n) => (n === i ? next : c)),
    }));
  const addCodemandado = () =>
    setDraft((d) => ({ ...d, codemandados: [...d.codemandados, emptyParty()] }));
  const removeCodemandado = (i: number) =>
    setDraft((d) => ({ ...d, codemandados: d.codemandados.filter((_, n) => n !== i) }));

  // Same pure validators the action re-runs, so a rejection is visible before the
  // round trip rather than after it.
  const validate = (): string | null => {
    const demandadoError = validateParty(draft.demandado, "El demandado");
    if (demandadoError) return demandadoError;
    for (let i = 0; i < draft.codemandados.length; i++) {
      const error = validateParty(draft.codemandados[i], labelForCodemandado(i));
      if (error) return error;
    }
    return null;
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const error = validate();
    if (error) {
      e.preventDefault();
      setClientError(error);
      return;
    }
    setClientError(null);
    // Cleared on submit; the error effect above puts it back if the action rejects.
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  const error = clientError ?? state?.error ?? null;

  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-6">
      {restored && (
        <Alert>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>Recuperamos un borrador de esta demanda.</span>
            <Button type="button" variant="outline" size="sm" onClick={discard}>
              Descartar borrador
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Demandado</CardTitle>
        </CardHeader>
        <CardContent>
          <PartyFieldsBlock
            value={draft.demandado}
            onChange={setDemandado}
            namePrefix=""
            idPrefix="dem"
            nombreLabel="Demandado"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4">
            <span>Codemandados</span>
            <Button type="button" variant="outline" size="sm" onClick={addCodemandado}>
              Agregar codemandado
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {draft.codemandados.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sin codemandados. Agregá uno por cada titular adicional de la tarjeta.
            </p>
          )}
          {draft.codemandados.map((cd, i) => (
            <div key={i} className="space-y-4 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Codemandado {i + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCodemandado(i)}
                >
                  Quitar
                </Button>
              </div>
              <PartyFieldsBlock
                value={cd}
                onChange={(next) => setCodemandado(i, next)}
                idPrefix={`cd${i}`}
              />
            </div>
          ))}
          {/* Codemandados travel as one JSON field: an unchecked Radix switch is
              simply absent from FormData, which would misalign parallel arrays. */}
          <input
            type="hidden"
            name="codemandados_json"
            value={JSON.stringify(draft.codemandados)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos del caso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cuenta_cliper">Cuenta Cliper</Label>
              <Input
                id="cuenta_cliper"
                name="cuenta_cliper"
                value={draft.cuenta_cliper}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, cuenta_cliper: onlyDigits(e.target.value) }))
                }
                inputMode="numeric"
                placeholder="Solo números"
              />
              <p className="text-xs text-muted-foreground">
                Es del caso, no de cada parte.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha_contrato">Fecha del contrato</Label>
              <Input
                id="fecha_contrato"
                name="fecha_contrato"
                type="date"
                value={draft.fecha_contrato}
                onChange={(e) => setDraft((d) => ({ ...d, fecha_contrato: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="deuda_inicial">Monto reclamado</Label>
              <Input
                id="deuda_inicial"
                name="deuda_inicial"
                type="number"
                step="0.01"
                value={draft.deuda_inicial}
                onChange={(e) => setDraft((d) => ({ ...d, deuda_inicial: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa</Label>
              <Select
                value={draft.empresa}
                onValueChange={(v) => setDraft((d) => ({ ...d, empresa: v }))}
              >
                <SelectTrigger id="empresa" className="w-full">
                  <SelectValue placeholder="Sin empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin empresa</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="empresa" value={draft.empresa} />
            </div>
          </div>

          <Separator />

          {/* A demanda that has not been filed yet has no expediente number; the
              field is here because a case loaded after filing usually does. */}
          <div className="space-y-2">
            <Label htmlFor="numero_expediente">N° de expediente</Label>
            <Input
              id="numero_expediente"
              name="numero_expediente"
              value={draft.numero_expediente}
              onChange={(e) =>
                setDraft((d) => ({ ...d, numero_expediente: e.target.value }))
              }
              placeholder="Todavía sin asignar"
            />
          </div>

          <JuzgadoPicker index={courtIndex} />
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" asChild type="button">
            <Link href="/ejecutados">Cancelar</Link>
          </Button>
          <Button type="submit">Crear demanda</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
