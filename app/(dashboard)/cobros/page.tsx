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
import { formatArs } from "@/lib/domain/cobros";

export default async function CobrosPage() {
  const supabase = await createClient();

  const [{ data: rows }, { data: totals }] = await Promise.all([
    supabase
      .from("cobros_pagos")
      .select("*, ejecutado:ejecutados(id, nombre)")
      .is("archived_at", null)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("cobros_totals")
      .select("total_solicitado, total_proveido, pagos_count"),
  ]);

  const totalSolicitado = (totals ?? []).reduce(
    (acc, t) => acc + Number(t.total_solicitado ?? 0),
    0,
  );
  const totalProveido = (totals ?? []).reduce(
    (acc, t) => acc + Number(t.total_proveido ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Cobros</h1>
        <p className="text-sm text-muted-foreground">
          {rows?.length ?? 0} pagos registrados
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border p-4">
          <div className="text-xs uppercase text-muted-foreground">Solicitado</div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatArs(totalSolicitado)}
          </div>
        </div>
        <div className="rounded-md border p-4">
          <div className="text-xs uppercase text-muted-foreground">Cobrado</div>
          <div className="text-2xl font-semibold tabular-nums text-emerald-600">
            {formatArs(totalProveido)}
          </div>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ejecutado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Nota</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows && rows.length > 0 ? (
              rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/ejecutados/${c.ejecutado_id}`}
                      className="hover:underline"
                    >
                      {c.ejecutado?.nombre ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {c.estado === "Proveído" ? (
                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                        Proveído
                      </Badge>
                    ) : (
                      <Badge variant="outline">Solicitado</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatArs(Number(c.monto))}
                  </TableCell>
                  <TableCell>
                    {new Date(c.fecha).toLocaleDateString("es-AR")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.nota || "—"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  Aún no hay cobros. Registrá el primero desde un ejecutado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}