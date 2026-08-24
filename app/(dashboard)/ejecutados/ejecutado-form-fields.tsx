import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MOVIMIENTO_OPTIONS,
  MEDIDA_CAUTELAR_OPTIONS,
  MEDIDA_ESTADO_OPTIONS,
} from "@/lib/domain/ejecutado";
import { CuilInput } from "@/components/cuil-input";
import { formatArDate } from "@/lib/domain/dates";
import { type Tables } from "@/lib/supabase/db-helpers";
import { type CourtEntry } from "@/lib/data/juzgados";
import { JuzgadoPicker } from "./juzgado-picker";
import { DateField } from "@/components/date-field";


/*
  Container-query roots, NOT viewport breakpoints. These sections have callers at
  very different widths - the detail page's Datos card, which owns two thirds of
  a full-width page, and /ejecutados/new, which splits them across a 2/3 column
  and a 1/3 rail. An `xl:` breakpoint reads the viewport and would pack four
  fields into that rail on any large screen. `@3xl` reads the section's own
  wrapper, so each placement gets the column count its width can actually carry.

  Each section is ONE grid with the fields as direct children rather than a stack
  of two-up rows. That is what lets the card be a rectangle instead of a column:
  at 2 columns the fields pair up as they always did, at 4 they repack into half
  as many rows. A two-field row inside a three-column grid would just leave a
  hole and save no height.
*/

type SectionProps = {
  ejecutado?: Tables<"ejecutados"> | null;
};

export function IdentidadFields({ ejecutado }: SectionProps) {
  return (
    <div className="@container space-y-4">
    {/* Identidad */}
    <SectionTitle>Identidad</SectionTitle>
    <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
      <div className="space-y-2 col-span-2 @3xl:col-span-4">
        <Label htmlFor="nombre">Demandado *</Label>
        <Input id="nombre" name="nombre" defaultValue={ejecutado?.nombre ?? ""} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cuil">CUIL</Label>
        <CuilInput id="cuil" name="cuil" defaultValue={ejecutado?.cuil ?? ""} showDni />
      </div>
      <div className="space-y-2">
        <Label htmlFor="documento">Documento</Label>
        <Input
          id="documento"
          name="documento"
          placeholder="DNI"
          defaultValue={ejecutado?.documento ?? ""}
        />
        {/* Kept editable for legacy rows that carry a DNI and no CUIL. Once a
            CUIL is present the save derives documento from it and this is
            ignored - mail-match and the escritos tokens still read it. */}
        <p className="text-xs text-muted-foreground">
          Se completa solo desde el CUIL.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="domicilio">Domicilio</Label>
        <Input id="domicilio" name="domicilio" defaultValue={ejecutado?.domicilio ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="telefono">Teléfono</Label>
        <Input id="telefono" name="telefono" defaultValue={ejecutado?.telefono ?? ""} />
      </div>
    </div>
    <p className="text-xs text-muted-foreground">
      Los codemandados se administran desde la ficha del ejecutado.
    </p>
    </div>
  );
}

export function ExpedienteFields({
  ejecutado,
  courtIndex,
  empresas,
}: SectionProps & { courtIndex: CourtEntry[]; empresas: string[] }) {
  // A case whose stored empresa is no longer configured keeps it selectable,
  // so opening the form cannot silently blank it on the next save.
  const empresaOptions =
    ejecutado?.empresa && !empresas.includes(ejecutado.empresa)
      ? [...empresas, ejecutado.empresa]
      : empresas;

  return (
    <div className="@container space-y-4">
    {/* Expediente */}
    <SectionTitle>Expediente</SectionTitle>
    <JuzgadoPicker
      index={courtIndex}
      defaultDepartamento={ejecutado?.departamento}
      defaultJuzgadoId={ejecutado?.juzgado_id}
      defaultJuzgadoLabel={ejecutado?.juzgado}
    />
    <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
      <div className="space-y-2">
        <Label htmlFor="numero_expediente">N° de expediente</Label>
        <Input
          id="numero_expediente"
          name="numero_expediente"
          placeholder="N° de causa, ej. 1513 o 1513/2019"
          pattern=".*\d.*"
          title="Debe contener el número de causa (1 a 7 dígitos)."
          defaultValue={ejecutado?.numero_expediente ?? ""}
        />
        <p className="text-xs text-muted-foreground">
          Se guarda el número de causa; el juzgado lo identifica el selector de arriba.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="empresa">Empresa</Label>
        <Select name="empresa" defaultValue={ejecutado?.empresa || "__none__"}>
          <SelectTrigger id="empresa">
            <SelectValue placeholder="Sin definir" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin definir</SelectItem>
            {empresaOptions.map((emp) => (
              <SelectItem key={emp} value={emp}>{emp}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="movimiento">Movimiento</Label>
        <Select name="movimiento" defaultValue={ejecutado?.movimiento ?? "__none__"}>
          <SelectTrigger id="movimiento">
            <SelectValue placeholder="Sin movimiento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin movimiento</SelectItem>
            {MOVIMIENTO_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="movimiento_diligenciada">
          Movimiento diligenciado
        </Label>
        <Select
          name="movimiento_diligenciada"
          defaultValue={triDefault(ejecutado?.movimiento_diligenciada)}
        >
          <SelectTrigger id="movimiento_diligenciada">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unknown__">Sin definir</SelectItem>
            <SelectItem value="si">Sí</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
    </div>
  );
}

export function FinancieroFields({ ejecutado }: SectionProps) {
  return (
    <div className="@container space-y-4">
    {/* Financiero */}
    <SectionTitle>Financiero</SectionTitle>
    <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
      <div className="space-y-2">
        <Label htmlFor="deuda_inicial">Deuda inicial (ARS)</Label>
        <Input
          id="deuda_inicial"
          name="deuda_inicial"
          type="number"
          step="0.01"
          min="0"
          defaultValue={ejecutado?.deuda_inicial ?? 0}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="gastos">Gastos (ARS)</Label>
        <Input
          id="gastos"
          name="gastos"
          type="number"
          step="0.01"
          min="0"
          defaultValue={ejecutado?.gastos ?? 0}
        />
      </div>
      {/* Gastos accrue interest at rates other than the debt's, so it is typed
          in rather than calculated. Both blank by default. */}
      <div className="space-y-2">
        <Label htmlFor="fecha_gastos">Fecha gastos</Label>
        <DateField
          id="fecha_gastos"
          name="fecha_gastos"
          defaultValue={ejecutado?.fecha_gastos ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="interes_gastos">Interés (ARS)</Label>
        <Input
          id="interes_gastos"
          name="interes_gastos"
          type="number"
          step="0.01"
          min="0"
          placeholder="Sin definir"
          defaultValue={ejecutado?.interes_gastos ?? ""}
        />
        <p className="text-xs text-muted-foreground">
          Interés sobre gastos. Se suma al total de la liquidación.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="fecha_mora">Fecha de mora (desde)</Label>
        <DateField
          id="fecha_mora"
          name="fecha_mora"
          defaultValue={ejecutado?.fecha_mora ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fecha_deuda">Fecha de deuda (hasta)</Label>
        <DateField
          id="fecha_deuda"
          name="fecha_deuda"
          defaultValue={ejecutado?.fecha_deuda ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="dinero_en_cuenta">Dinero en cuenta (ARS)</Label>
        <Input
          id="dinero_en_cuenta"
          name="dinero_en_cuenta"
          type="number"
          step="0.01"
          defaultValue={ejecutado?.dinero_en_cuenta ?? ""}
        />
      </div>
    </div>
    {ejecutado?.practica_liquidacion && (
      <div className="space-y-1">
        <Label className="text-muted-foreground">Práctica de liquidación</Label>
        <p className="text-sm">{formatArDate(ejecutado.practica_liquidacion)}</p>
      </div>
    )}
    </div>
  );
}

export function MedidaCautelarFields({ ejecutado }: SectionProps) {
  return (
    <div className="@container space-y-4">
    {/* Medida cautelar */}
    <SectionTitle>Medida cautelar</SectionTitle>
    <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="medida_cautelar">Tipo</Label>
        <Select name="medida_cautelar" defaultValue={ejecutado?.medida_cautelar ?? "__none__"}>
          <SelectTrigger id="medida_cautelar">
            <SelectValue placeholder="Ninguna" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Ninguna</SelectItem>
            {MEDIDA_CAUTELAR_OPTIONS.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="medida_cautelar_estado">Estado</Label>
        <Select
          name="medida_cautelar_estado"
          defaultValue={ejecutado?.medida_cautelar_estado ?? "__none__"}
        >
          <SelectTrigger id="medida_cautelar_estado">
            <SelectValue placeholder="Sin definir" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin definir</SelectItem>
            {MEDIDA_ESTADO_OPTIONS.map((estado) => (
              <SelectItem key={estado} value={estado}>{estado}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="medida_cautelar_diligenciada">Diligenciada</Label>
        <Select
          name="medida_cautelar_diligenciada"
          defaultValue={ejecutado?.medida_cautelar_diligenciada ? "si" : "no"}
        >
          <SelectTrigger id="medida_cautelar_diligenciada">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="si">Sí</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
    <div className="space-y-2">
      <Label htmlFor="medida_cautelar_nota">Nota de la medida cautelar</Label>
      <Textarea
        id="medida_cautelar_nota"
        name="medida_cautelar_nota"
        rows={2}
        defaultValue={ejecutado?.medida_cautelar_nota ?? ""}
      />
      {ejecutado && !ejecutado.medida_cautelar_nota?.trim() && (
        <p className="text-xs text-muted-foreground">Sin notas.</p>
      )}
    </div>
    </div>
  );
}

export function NotasFields({ ejecutado }: SectionProps) {
  return (
    <div className="@container space-y-4">
    {/* Notas */}
    <SectionTitle>Notas</SectionTitle>
    <div className="space-y-2">
      <Label htmlFor="observaciones">Observaciones</Label>
      <Textarea
        id="observaciones"
        name="observaciones"
        rows={4}
        defaultValue={ejecutado?.observaciones ?? ""}
      />
    </div>
    </div>
  );
}

/**
 * All five sections, in order - what the detail page's Datos card renders.
 * /ejecutados/new composes the sections itself so it can split them across its
 * two columns, which is the whole reason they are exported separately.
 */
export function EjecutadoFormFields({
  ejecutado,
  courtIndex,
  empresas,
}: {
  ejecutado?: Tables<"ejecutados"> | null;
  courtIndex: CourtEntry[];
  empresas: string[];
}) {
  return (
    <div className="space-y-4">
      <IdentidadFields ejecutado={ejecutado} />
      <ExpedienteFields ejecutado={ejecutado} courtIndex={courtIndex} empresas={empresas} />
      <FinancieroFields ejecutado={ejecutado} />
      <MedidaCautelarFields ejecutado={ejecutado} />
      <NotasFields ejecutado={ejecutado} />
    </div>
  );
}

// 3-state Select default: the column is nullable and "no definido" is a real,
// distinct answer from "no".
function triDefault(value: boolean | null | undefined): string {
  return value === true ? "si" : value === false ? "no" : "__unknown__";
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-2 first:pt-0">
      <h3 className="text-sm font-medium text-muted-foreground">{children}</h3>
      <Separator className="mt-2" />
    </div>
  );
}
