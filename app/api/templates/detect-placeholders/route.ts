import { NextResponse } from "next/server";
import {
  detectManualPlaceholders,
  extractPlaceholders,
} from "@/lib/domain/template-engine";

// Scans `contenido` for {{...}} and returns the manual-input set the lawyer
// must fill at generate time, plus every placeholder found.
export async function POST(request: Request) {
  let contenido = "";
  try {
    const body = await request.json();
    contenido = typeof body?.contenido === "string" ? body.contenido : "";
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  return NextResponse.json({
    placeholders: extractPlaceholders(contenido),
    manualInputs: detectManualPlaceholders(contenido),
  });
}
