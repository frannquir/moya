import { type Tables } from "@/lib/supabase/db-helpers";

export type Honorario = Tables<"honorarios">;
export type HonorarioPago = Tables<"honorarios_pagos">;

// The two regulated honorario types (JUS).
export const HONORARIO_TIPOS = [3.5, 7] as const;
export type HonorarioTipo = (typeof HONORARIO_TIPOS)[number];

export function jusToArs(jus: number, jusValue: number): number {
  return Math.round(jus * jusValue);
}

export function arsToJus(ars: number, jusValue: number): number {
  if (!(jusValue > 0)) return 0;
  return Math.round((ars / jusValue) * 100) / 100; // 2-dp JUS
}

export function remainingJus(capJus: number, pagadoJus: number): number {
  return Math.max(0, capJus - pagadoJus);
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