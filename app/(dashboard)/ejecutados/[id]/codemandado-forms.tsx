"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PartyFieldsBlock } from "@/components/party-fields";
import { emptyParty, validateParty, type PartyFields } from "@/lib/domain/demanda";
import { formatDni, cuilToDni } from "@/lib/domain/cuil";

type Action = (formData: FormData) => void | Promise<void>;

/**
 * Shared body for both the edit and the add flow: holds the party in state (so
 * PartyFieldsBlock stays controlled and the trabaja switch can reveal the employer
 * block), emits named inputs, and runs the same pure validator the server action
 * re-runs so a rejection shows up here instead of as a thrown error page.
 */
function PartyForm({
  action,
  initial,
  idPrefix,
  submitLabel,
  onCancel,
  nombreLabel,
}: {
  action: Action;
  initial: PartyFields;
  idPrefix: string;
  submitLabel: string;
  onCancel?: () => void;
  nombreLabel?: string;
}) {
  const [party, setParty] = useState<PartyFields>(initial);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const message = validateParty(party, "El codemandado");
        if (message) {
          e.preventDefault();
          setError(message);
          return;
        }
        setError(null);
      }}
      className="space-y-4"
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <PartyFieldsBlock
        value={party}
        onChange={setParty}
        namePrefix=""
        idPrefix={idPrefix}
        nombreLabel={nombreLabel}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}

export function CodemandadoEditor({
  id,
  party,
  updateAction,
  archiveAction,
}: {
  id: string;
  party: PartyFields;
  updateAction: Action;
  archiveAction: Action;
}) {
  const [open, setOpen] = useState(false);
  const dni = cuilToDni(party.cuil);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-md border px-4 py-3"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-medium">{party.nombre}</p>
          <p className="text-xs text-muted-foreground">
            {party.cuil !== ""
              ? `C.U.I.L. N° ${party.cuil}${dni !== "" ? ` — D.N.I. N° ${formatDni(dni)}` : ""}`
              : "Sin CUIL cargado"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={party.trabaja ? "default" : "secondary"}>
            {party.trabaja ? "Trabaja" : "No trabaja"}
          </Badge>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="sm">
              {open ? "Cerrar" : "Editar"}
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent className="pt-4">
        <PartyForm
          action={updateAction}
          initial={party}
          idPrefix={`cd-${id}`}
          submitLabel="Guardar"
          onCancel={() => setOpen(false)}
        />
        {/* Sibling form, never nested: an archive button inside the edit form
            would post the edit instead. "Eliminar" sets archived_at. */}
        <form action={archiveAction} className="mt-4 border-t pt-4">
          <Button type="submit" variant="ghost" size="sm" className="text-destructive">
            Eliminar codemandado
          </Button>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CodemandadoAdder({ createAction }: { createAction: Action }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Agregar codemandado
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-dashed p-4">
      <PartyForm
        action={createAction}
        initial={emptyParty()}
        idPrefix="cd-nuevo"
        submitLabel="Agregar"
        onCancel={() => setOpen(false)}
        nombreLabel="Nombre"
      />
    </div>
  );
}
