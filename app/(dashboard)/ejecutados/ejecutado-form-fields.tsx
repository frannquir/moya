import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabelConInfo } from "@/components/label-info";
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
import { type Tables } from "@/lib/supabase/db-helpers";
import { type CourtEntry } from "@/lib/data/juzgados";
import { JuzgadoPicker } from "./juzgado-picker";
import { DateField } from "@/components/date-field";
import { ArsInput } from "@/components/ars-input";


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
  /**
   * Drop the section's own heading. The detail page stacks several sections in
   * ONE card, so the headings are what separate them; /ejecutados/new gives some
   * of them a card each, where the heading just repeats the card title.
   */
  sinTitulo?: boolean;
};

export function IdentidadFields({ ejecutado, sinTitulo }: SectionProps) {
  return (
    <div className="@container space-y-4">
    {/* Identidad */}
    {!sinTitulo && <SectionTitle>Identidad</SectionTitle>}
    <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
      <div className="space-y-2 col-span-2 @3xl:col-span-4">
        <Label htmlFor="nombre">Demandado *</Label>
        <Input id="nombre" name="nombre" defaultValue={ejecutado?.nombre ?? ""} required />
      </div>
      <div className="space-y-2">
        <LabelConInfo htmlFor="cuil" campo="cuil">CUIL</LabelConInfo>
        <CuilInput id="cuil" name="cuil" defaultValue={ejecutado?.cuil ?? ""} showDni />
      </div>
      <div className="space-y-2">
        <LabelConInfo htmlFor="documento" campo="documento">Documento</LabelConInfo>
        <Input
          id="documento"
          name="documento"
          placeholder="DNI"
          defaultValue={ejecutado?.documento ?? ""}
        />
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
    </div>
  );
}

export function ExpedienteFields({
  ejecutado,
  sinTitulo,
  courtIndex,
  empresas,
  showMovimiento = true,
}: SectionProps & {
  courtIndex: CourtEntry[];
  empresas: string[];
  /**
   * The ejecutado detail page passes false: its header has its own
   * movimiento dropdown (feature 7), and rendering the field in both places
   * would give the column two writers (gotcha #41). /ejecutados/new has no
   * header to put it in, so it keeps the default.
   */
  showMovimiento?: boolean;
}) {
  // A case whose stored empresa is no longer configured keeps it selectable,
  // so opening the form cannot silently blank it on the next save.
  const empresaOptions =
    ejecutado?.empresa && !empresas.includes(ejecutado.empresa)
      ? [...empresas, ejecutado.empresa]
      : empresas;

  return (
    <div className="@container space-y-4">
    {/* Expediente */}
    {!sinTitulo && <SectionTitle>Expediente</SectionTitle>}
    <JuzgadoPicker
      index={courtIndex}
      defaultDepartamento={ejecutado?.departamento}
      defaultJuzgadoId={ejecutado?.juzgado_id}
      defaultJuzgadoLabel={ejecutado?.juzgado}
    />
    <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
      <div className="space-y-2">
        <LabelConInfo htmlFor="numero_expediente" campo="numero_expediente">N° de expediente</LabelConInfo>
        <Input
          id="numero_expediente"
          name="numero_expediente"
          placeholder="N° de causa, ej. 1513 o 1513/2019"
          pattern=".*\d.*"
          title="Debe contener el número de causa (1 a 7 dígitos)."
          defaultValue={ejecutado?.numero_expediente ?? ""}
        />
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
      {showMovimiento && (
        <>
          <div className="space-y-2">
            <LabelConInfo htmlFor="movimiento" campo="movimiento">Movimiento</LabelConInfo>
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
            <LabelConInfo htmlFor="movimiento_diligenciada" campo="movimiento_diligenciada">Diligenciado</LabelConInfo>
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
        </>
      )}
    </div>
    </div>
  );
}

/**
 * The RIGHT column's form: only the columns the liquidación is computed from.
 * Matches EjecutadoMontosFields exactly — a field added here must be added there
 * too, or the save silently drops it.
 */
export function MontosFields({ ejecutado, sinTitulo }: SectionProps) {
  return (
    <div className="@container space-y-4">
    {/* Financiero */}
    {!sinTitulo && <SectionTitle>Financiero</SectionTitle>}
    <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
      <div className="space-y-2">
        <Label htmlFor="deuda_inicial">Deuda inicial</Label>
        <ArsInput
          id="deuda_inicial"
          name="deuda_inicial"
          min={0}
          defaultValue={ejecutado?.deuda_inicial ?? 0}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="gastos">Gastos</Label>
        <ArsInput
          id="gastos"
          name="gastos"
          min={0}
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
        <LabelConInfo htmlFor="interes_gastos" campo="interes_gastos">Interés s/ gastos</LabelConInfo>
        <ArsInput
          id="interes_gastos"
          name="interes_gastos"
          min={0}
          placeholder="Sin definir"
          defaultValue={ejecutado?.interes_gastos ?? ""}
        />
      </div>
      <div className="space-y-2">
        <LabelConInfo htmlFor="fecha_mora" campo="fecha_mora">Fecha de mora</LabelConInfo>
        <DateField
          id="fecha_mora"
          name="fecha_mora"
          defaultValue={ejecutado?.fecha_mora ?? ""}
        />
      </div>
      <div className="space-y-2">
        <LabelConInfo htmlFor="fecha_deuda" campo="fecha_deuda">Fecha de deuda</LabelConInfo>
        <DateField
          id="fecha_deuda"
          name="fecha_deuda"
          defaultValue={ejecutado?.fecha_deuda ?? ""}
        />
      </div>
    </div>
    </div>
  );
}

export function MedidaCautelarFields({ ejecutado, sinTitulo }: SectionProps) {
  return (
    <div className="@container space-y-4">
    {/* Medida cautelar */}
    {!sinTitulo && <SectionTitle>Medida cautelar</SectionTitle>}
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
    {/* dinero_en_cuenta only exists because an embargo was granted, so it reads
        beside the medida rather than with the liquidación's inputs. */}
    <div className="space-y-2">
      <LabelConInfo htmlFor="dinero_en_cuenta" campo="dinero_en_cuenta">Dinero en cuenta</LabelConInfo>
      <ArsInput
        id="dinero_en_cuenta"
        name="dinero_en_cuenta"
        defaultValue={ejecutado?.dinero_en_cuenta ?? ""}
      />
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

export function NotasFields({ ejecutado, sinTitulo }: SectionProps) {
  return (
    <div className="@container space-y-4">
    {/* Notas */}
    {!sinTitulo && <SectionTitle>Notas</SectionTitle>}
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
      <MontosFields ejecutado={ejecutado} />
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
