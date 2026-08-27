// The "i" copy, in one place. Each entry explains the concept and what depends
// on the field, in one or two plain sentences — never a restatement of the label,
// and never why the system works that way.
//
// Not every field gets one. Demandado, Domicilio, Teléfono, Observaciones and the
// empleador block are self-evident and have no entry.

export type CampoAyuda = {
  /** Not rendered in the bubble; it names the field in the trigger's aria-label. */
  titulo: string;
  /** One or two sentences. Argentine legal vocabulary, same register as the UI. */
  texto: string;
};

export const CAMPO_AYUDA: Record<string, CampoAyuda> = {
  // --- the stage pair: the two fields that drive the escrito recommendations ---
  movimiento: {
    titulo: "Movimiento",
    texto:
      "La etapa procesal de la causa. Junto con «Diligenciado» define qué escritos te recomienda Moya.",
  },
  movimiento_diligenciada: {
    titulo: "Diligenciado",
    texto:
      "Si el movimiento ya volvió cumplido del juzgado. Una cédula diligenciada habilita preparar la vía; una sin diligenciar se vuelve a librar. No es lo mismo que la diligencia de la medida cautelar.",
  },

  // --- identity ---
  cuil: {
    titulo: "CUIL",
    texto:
      "Formato NN-DDDDDDDD-V. Se valida el dígito verificador. De acá sale el DNI que imprimen los escritos.",
  },
  documento: {
    titulo: "Documento",
    texto: "Se completa solo a partir del CUIL. No hace falta escribirlo.",
  },
  numero_expediente: {
    titulo: "N° de expediente",
    texto:
      "El número de causa. Se guarda normalizado, así que da igual cómo lo escribas. Sirve para vincular los mails del MEV con esta causa.",
  },

  // --- money ---
  fecha_mora: {
    titulo: "Fecha de mora",
    texto:
      "El vencimiento del último resumen impago. Los intereses corren desde acá. Sin esta fecha no se genera la liquidación.",
  },
  fecha_deuda: {
    titulo: "Fecha de deuda",
    texto: "Hasta cuándo se calculan los intereses. Si la dejás vacía, hasta hoy.",
  },
  interes_gastos: {
    titulo: "Interés sobre gastos",
    texto:
      "Interés de los gastos. Va a mano porque usa otra tasa que el capital. Se suma al total sin IVA.",
  },
  dinero_en_cuenta: {
    titulo: "Dinero en cuenta",
    texto: "Lo retenido en la cuenta por el embargo. La liquidación no lo descuenta.",
  },
  practica_liquidacion: {
    titulo: "Práctica de liquidación",
    texto: "La fecha en que se practicó la liquidación. La pone el sistema al generarla.",
  },

  // --- demanda ---
  fojas_resumenes: {
    titulo: "Fojas de resúmenes",
    texto:
      "Cuántas fojas de resúmenes acompañás. Es lo único que varía del bloque DOCUMENTAL: contrato y acuse van fijos.",
  },
  cuenta_cliper: {
    titulo: "Cuenta Cliper",
    texto: "Una sola por caso: la comparten el demandado y todos los codemandados.",
  },
  tarjeta_cabal: {
    titulo: "Tarjeta Cabal",
    texto: "Una por parte. Cada codemandado tiene la suya.",
  },

  // --- convenio ---
  monto_acuerdo: {
    titulo: "Monto del acuerdo",
    texto: "Lo que el deudor se compromete a pagar. No es la deuda original: es lo negociado.",
  },
  fecha_vencimiento: {
    titulo: "Vencimiento de la primera",
    texto:
      "Cuándo vence la primera cuota. Las demás caen el mismo día de los meses siguientes. Si alguna cae en día inhábil, se paga el día hábil posterior.",
  },
  cuotas: {
    titulo: "Cuotas",
    texto: "En cuántos pagos se divide el acuerdo.",
  },
};

export function ayudaDe(campo: string): CampoAyuda | null {
  return CAMPO_AYUDA[campo] ?? null;
}
