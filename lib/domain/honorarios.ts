import { type Tables } from "@/lib/supabase/db-helpers";

export type Honorario = Tables<"honorarios">;
export type HonorarioPago = Tables<"honorarios_pagos">;

export function jusToArs(jus: number, jusValue: number): number {
  return Math.round(jus * jusValue);
}

export function formatArs(ars: number): string {
  return ars.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

export function formatJus(jus: number): string {
  return `${jus.toLocaleString("es-AR", { maximumFractionDigits: 2 })} JUS`;
}