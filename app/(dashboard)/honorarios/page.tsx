import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatJus, formatArs, jusToArs } from "@/lib/domain/honorarios";

export default async function HonorariosPage() {
  const supabase = await createClient();

  const [{ data: rows }, { data: jusRow }] = await Promise.all([
    supabase
      .from("honorarios_with_balance")
      .select("*, ejecutado:ejecutados(id, nombre)")
      .order("pendiente_jus", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("system_config")
      .select("value")
      .eq("key", "jus_config")
      .single(),
  ]);

  const jusValue = (jusRow?.value as { value: number })?.value ?? 0;
  const pendingCount =
    rows?.filter((h) => (h.pendiente_jus ?? 0) > 0).length ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Honorarios</h1>
        <p className="text-sm text-muted-foreground">
          {rows?.length ?? 0} honorarios · {pendingCount} pendientes · Valor JUS: {formatArs(jusValue)}
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ejecutado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Pactado</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Pendiente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows && rows.length > 0 ? (
              rows.map((h) => {
                const isPaid =
                  (h.monto_total_jus ?? 0) > 0 && (h.pendiente_jus ?? 0) <= 0;
                return (
                  <TableRow key={h.id} className={isPaid ? "opacity-60" : ""}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/ejecutados/${h.ejecutado_id}`}
                        className="hover:underline"
                      >
                        {h.ejecutado?.nombre ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {isPaid ? (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                          Pagado
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pendiente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatJus(h.monto_total_jus ?? 0)}
                      <div className="text-xs text-muted-foreground">
                        {formatArs(jusToArs(h.monto_total_jus ?? 0, jusValue))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatJus(h.pagado_jus ?? 0)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        (h.pendiente_jus ?? 0) > 0 ? "text-orange-600 font-medium" : ""
                      }`}
                    >
                      {formatJus(h.pendiente_jus ?? 0)}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Aún no hay honorarios. Creá el primero desde un ejecutado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 