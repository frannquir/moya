"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CuilInput } from "@/components/cuil-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IVA_OPTIONS } from "@/lib/domain/escritos-config";
import { updateLawyerProfile, type ProfileState } from "./actions";

export type ProfileInitial = {
  nombre: string;
  matricula: string;
  cuit: string;
  legajo: string;
  ibm: string;
  domicilio_electronico: string;
  telefono: string;
  genero: string | null;
  es_abogado: boolean;
  iva_condicion: string;
};

/**
 * The profile form, split out of the page so it can hold useActionState.
 *
 * The action used to `throw` on an invalid CUIT, which escaped to the dashboard
 * error boundary: the form unmounted, "Algo salió mal" replaced the page, the
 * Spanish message ended up inside a collapsed <details>, and everything typed was
 * gone. Returning the errors keeps every field exactly where it was, because
 * nothing unmounts — the inputs are uncontrolled and their DOM values survive the
 * re-render.
 */
export function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const [state, formAction] = useActionState<ProfileState, FormData>(
    updateLawyerProfile,
    null,
  );

  const errors = state && "errors" in state ? state.errors : [];
  const saved = state !== null && "ok" in state;

  return (
    <form action={formAction} className="space-y-4">
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="font-medium">
              No se guardó el perfil. Lo que cargaste sigue en el formulario:
              corregí {errors.length === 1 ? "esto" : "estos puntos"} y volvé a
              guardar.
            </p>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {saved && (
        <Alert>
          <AlertDescription>Perfil guardado.</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre completo</Label>
        <Input id="nombre" name="nombre" defaultValue={initial.nombre} />
      </div>

      <div className="@container grid grid-cols-1 gap-4 @sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="matricula">Matrícula</Label>
          <Input id="matricula" name="matricula" defaultValue={initial.matricula} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cuit">CUIT</Label>
          {/* One masked CUIT input across the app: ejecutados, empleadores,
              empresas, encargado and here all go through CuilInput and
              isValidCuil. A personal CUIT is the same mod-11 construction. */}
          <CuilInput id="cuit" name="cuit" defaultValue={initial.cuit} />
        </div>
      </div>

      <div className="@container grid grid-cols-1 gap-4 @sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="legajo">Legajo</Label>
          <Input id="legajo" name="legajo" defaultValue={initial.legajo} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ibm">IBM</Label>
          <Input id="ibm" name="ibm" defaultValue={initial.ibm} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="domicilio_electronico">Domicilio electrónico</Label>
        <Input
          id="domicilio_electronico"
          name="domicilio_electronico"
          type="email"
          defaultValue={initial.domicilio_electronico}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="telefono">Teléfono</Label>
        <Input
          id="telefono"
          name="telefono"
          type="tel"
          defaultValue={initial.telefono}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="genero">Género</Label>
        <Select name="genero" defaultValue={initial.genero ?? "__none__"}>
          <SelectTrigger id="genero">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin especificar</SelectItem>
            <SelectItem value="F">Femenino</SelectItem>
            <SelectItem value="M">Masculino</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Junto con la matrícula define el tratamiento (Dr. / Dra. / Sr. / Sra.)
          cuando figurás entre los autorizados de un escrito.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-md border p-3">
        {/* Uncontrolled: Radix submits the hidden checkbox only when it is
            on, and an absent field means false, which is what we want. */}
        <Switch
          id="es_abogado"
          name="es_abogado"
          value="true"
          defaultChecked={initial.es_abogado}
        />
        <Label htmlFor="es_abogado" className="cursor-pointer">
          Soy abogado/a
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="iva_condicion">Condición frente al IVA</Label>
        <Select name="iva_condicion" defaultValue={initial.iva_condicion}>
          <SelectTrigger id="iva_condicion">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {IVA_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="pt-2">
        <Button type="submit">Guardar</Button>
      </div>
    </form>
  );
}
