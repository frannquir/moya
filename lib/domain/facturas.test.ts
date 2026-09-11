import { describe, it, expect } from "vitest";
import {
  calcFactura,
  montoMensaje,
  generateMensajeCuotaLitis,
  generateMensajeFacturaB,
  generateMensaje,
} from "./facturas";
import { extractUnresolved } from "./template-engine";
import { destinoDe } from "./token-destino";

describe("montoMensaje", () => {
  it("escribe los montos como se leen en Argentina", () => {
    // Era toFixed(2), que producia "$24000.00" — ni formato argentino ni ingles.
    expect(montoMensaje(24000)).toBe("$24.000,00");
    expect(montoMensaje(257102.5)).toBe("$257.102,50");
    expect(montoMensaje(5040)).toBe("$5.040,00");
  });
});

describe("generateMensajeCuotaLitis", () => {
  const base = {
    demandado: "OLIVERA SILVANA VANESA",
    monto: 160000,
    empresa: "Tartan",
  };

  it("factura el 15% del pago del deudor, mas IVA", () => {
    const { base: b, iva, total } = calcFactura(160000);
    expect(b).toBe(24000);
    expect(iva).toBe(5040);
    expect(total).toBe(29040);
  });

  it("nombra la empresa y el deudor con los montos formateados", () => {
    const m = generateMensajeCuotaLitis(base);
    expect(m).toContain("para Tartan");
    expect(m).toContain("del deudor OLIVERA SILVANA VANESA");
    expect(m).toContain("$24.000,00 + $5.040,00 IVA, total: $29.040,00");
  });

  it("marca la empresa faltante en vez de inventarla", () => {
    const m = generateMensajeCuotaLitis({ ...base, empresa: null });
    expect(m).toContain("[EMPRESA]");
    expect(extractUnresolved(m)).toEqual(["EMPRESA"]);
  });
});

describe("generateMensajeFacturaB", () => {
  const base = {
    demandado: "GERVASSIO SALVADOR AGUSTIN ALEJANDRO",
    documento: "44111091",
    montoArs: 257102.5,
  };

  it("pide la Fact B a nombre del deudor, con su DNI y los aportes", () => {
    const m = generateMensajeFacturaB(base);
    expect(m).toContain("a nombre de GERVASSIO SALVADOR AGUSTIN ALEJANDRO");
    expect(m).toContain("dni 44111091");
    expect(m).toContain("el total de $257.102,50");
    // 10% sobre la base de 196.261,45 — el mismo numero que imprime la card.
    expect(m).toContain("el 10% de aportes $19.626,15");
  });

  it("marca el documento faltante, que es el caso comun hoy", () => {
    // 7 de 10 pagos de honorarios del estudio no tienen documento cargado.
    const m = generateMensajeFacturaB({ ...base, documento: "" });
    expect(m).toContain("dni [DOCUMENTO]");
    expect(extractUnresolved(m)).toEqual(["DOCUMENTO"]);
  });

  it("cada marcador sabe como se llama y donde se completa", () => {
    const m = generateMensajeFacturaB({ demandado: "", documento: "", montoArs: 1000 });
    const faltantes = extractUnresolved(m);
    expect(faltantes.sort()).toEqual(["DEMANDADO", "DOCUMENTO"]);
    for (const t of faltantes) {
      const d = destinoDe(t);
      expect(d).not.toBeNull();
      // Ambos se cargan en el ejecutado, que es a donde enlaza el badge.
      expect(d!.donde).toBe("caso");
    }
  });
});

describe("generateMensaje", () => {
  it("elige el mensaje segun el tipo de pago", () => {
    const cuota = generateMensaje({
      tipo: "cuota-litis",
      demandado: "X",
      monto: 160000,
      empresa: "Tartan",
    });
    const facturaB = generateMensaje({
      tipo: "factura-b",
      demandado: "X",
      monto: 257102.5,
      documento: "1",
    });
    expect(cuota).toContain("pacto cuota litis");
    expect(facturaB).toContain("Fact B");
  });
});
