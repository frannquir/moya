import { type Tables } from "@/lib/supabase/db-helpers";

export type CobroPago = Tables<"cobros_pagos">;
export type CobroEstado = "Solicitado" | "Proveído";

export function formatArs(ars: number): string {
  return ars.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}