import type { Metadata } from "next";
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
import {
  IVA_RATE,
  APORTES_RATE,
  formatJus,
  formatArs,
  jusToArs,
  saldoHonorario,
} from "@/lib/domain/honorarios";

export const metadata: Metadata = { title: "Honorarios" };

export default async function HonorariosPage() {
  const supabase = await createClient();

  const [{ data: honorarios }, { data: jusRow }] = await Promise.all([
    supabase
      .from("honorarios_with_balance")
      .select("*, ejecutado:ejecutados(id, nombre, archived_at)")
      .order("pendiente_jus", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("system_config")
      .select("value")
      .eq("key", "jus_config")
      .single(),
  ]);

  const jusValue = (jusRow?.value as { value: number })?.value ?? 0;

  // Hide honorarios whose ejecutado is archived, and resolve the ceiling the
  // same way the ejecutado card does. Not from the view's cap_cobrable_ars /
  // pendiente_cobrable_ars: those mix a ceiling converted at today's JUS with
  // pesos received at the JUS of their own dates (see saldoHonorario).
  const rows = (honorarios ?? [])
    .filter((h) => !h.ejecutado?.archived_at)
    .map((h) => ({ ...h, techo: saldoHonorario(h, jusValue) }));

  // "Pendiente" means there is still something collectable — measured against
  // the gross cap, since IVA + aportes are collected on top of the fee.
  const pendingCount = rows.filter((h) => h.techo.pendienteArs > 0).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Honorarios</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} honorarios · {pendingCount} pendientes · Valor JUS:{" "}
          {formatArs(jusValue)} · Máximo a cobrar = honorario + IVA{" "}
          {Math.round(IVA_RATE * 100)}% + aportes {Math.round(APORTES_RATE * 100)}%, o
          lo acordado con el ejecutado
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ejecutado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Honorario</TableHead>
              <TableHead className="text-right">Máximo a cobrar</TableHead>
              <TableHead className="text-right">Cobrado</TableHead>
              <TableHead className="text-right">Restante</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((h) => {
                // Read from the same figure the "Restante" cell prints, so the
                // badge can never say Pendiente next to a $0.
                const isPaid = (h.monto_total_jus ?? 0) > 0 && h.techo.pendienteArs <= 0;
                // Fee covered but the tax on it not yet — a real intermediate state.
                const baseCubierto =
                  !isPaid &&
                  (h.monto_total_jus ?? 0) > 0 &&
                  (h.pendiente_jus ?? 0) <= 0;
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
                        <Badge variant="success">
                          Pagado
                        </Badge>
                      ) : baseCubierto ? (
                        <Badge variant="outline">Honorario cubierto</Badge>
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
                      {formatArs(h.techo.capArs)}
                      <div className="text-xs text-muted-foreground">
                        {h.max_acordado_ars != null
                          ? "acordado"
                          : `honorario + IVA + aportes`}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatArs(h.pagado_ars ?? 0)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        h.techo.pendienteArs > 0 ? "text-warning font-medium" : ""
                      }`}
                    >
                      {formatArs(h.techo.pendienteArs)}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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