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
  formatCodemandados,
} from "@/lib/domain/ejecutado";
import { type Tables } from "@/lib/supabase/db-helpers";

// Shared field set for the create (new/) and edit ([id]/) ejecutado forms.
// Render this inside a <form> + <CardContent>; the surrounding header/footer
// (buttons differ between create and edit) stay in the caller.
export function EjecutadoFormFields({
  ejecutado,
  departamentos,
  empresas,
}: {
  ejecutado?: Tables<"ejecutados"> | null;
  departamentos: string[];
  empresas: string[];
}) {
  // Keep a current value in the option list even if it's no longer configured,
  // so editing an ejecutado never silently drops its departamento/empresa.
  const depOptions =
    ejecutado?.departamento && !departamentos.includes(ejecutado.departamento)
      ? [...departamentos, ejecutado.departamento]
      : departamentos;
  const empresaOptions =
    ejecutado?.empresa && !empresas.includes(ejecutado.empresa)
      ? [...empresas, ejecutado.empresa]
      : empresas;

  const triDefault = (value: boolean | null | undefined) =>
    value === true ? "si" : value === false ? "no" : "__unknown__";

  return (
    <>
      {/* Identidad */}
      <SectionTitle>Identidad</SectionTitle>
      <div className="space-y-2">
        <Label htmlFor="nombre">Demandado *</Label>
        <Input id="nombre" name="nombre" defaultValue={ejecutado?.nombre ?? ""} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="codemandados">Codemandados</Label>
        <Textarea
          id="codemandados"
          name="codemandados"
          rows={2}
          placeholder="Separados por coma"
          defaultValue={formatCodemandados(ejecutado?.codemandados)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="documento">Documento</Label>
          <Input
            id="documento"
            name="documento"
            placeholder="DNI / CUIT"
            defaultValue={ejecutado?.documento ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="domicilio">Domicilio</Label>
          <Input id="domicilio" name="domicilio" defaultValue={ejecutado?.domicilio ?? ""} />
        </div>
      </div>

      {/* Expediente */}
      <SectionTitle>Expediente</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="juzgado">Juzgado</Label>
          <Input id="juzgado" name="juzgado" defaultValue={ejecutado?.juzgado ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="departamento">Departamento</Label>
          <Select name="departamento" defaultValue={ejecutado?.departamento || "__none__"}>
            <SelectTrigger id="departamento">
              <SelectValue placeholder="Sin departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin departamento</SelectItem>
              {depOptions.map((dep) => (
                <SelectItem key={dep} value={dep}>{dep}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="numero_expediente">N° de expediente</Label>
          <Input
            id="numero_expediente"
            name="numero_expediente"
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
      </div>
      <div className="grid grid-cols-2 gap-4">
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

      {/* Financiero */}
      <SectionTitle>Financiero</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
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
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="fecha_mora">Fecha de mora (desde)</Label>
          <Input
            id="fecha_mora"
            name="fecha_mora"
            type="date"
            defaultValue={ejecutado?.fecha_mora ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fecha_deuda">Fecha de deuda (hasta)</Label>
          <Input
            id="fecha_deuda"
            name="fecha_deuda"
            type="date"
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
          <p className="text-sm">{ejecutado.practica_liquidacion}</p>
        </div>
      )}

      {/* Medida cautelar */}
      <SectionTitle>Medida cautelar</SectionTitle>
      <div className="grid grid-cols-3 gap-4">
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
      </div>

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
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-2 first:pt-0">
      <h3 className="text-sm font-medium text-muted-foreground">{children}</h3>
      <Separator className="mt-2" />
    </div>
  );
}
