import { describe, it, expect } from "vitest";
import {
  clusterUnassigned,
  clusterKey,
  localidadCompatible,
  mailMatchesCluster,
  headerOfMail,
  type ClusterMailInput,
} from "./mail-cluster";
import { parseMevHeader } from "./mail-match";

// Mirror the real MEV one-line body shape the matcher parses.
function mevMail(
  id: string,
  organismo: string,
  caratula: string,
  causa: string,
  received_at: string | null = "2026-06-01T12:00:00Z",
): ClusterMailInput {
  return {
    id,
    subject: `${organismo} - Causa: ${causa}`,
    snippet: caratula,
    body_text:
      `Organismo:\t${organismo}\n` +
      `Carátula:\t${caratula}\n` +
      `Nro de causa:\t${causa}\n` +
      `Estado:\tEn Letra`,
    from_email: "mev@scba.gov.ar",
    received_at,
  };
}

describe("clusterKey", () => {
  it("separates same causa number in different cities", () => {
    expect(clusterKey("1513", "Olavarría", 1)).not.toBe(
      clusterKey("1513", "Tandil", 1),
    );
  });
  it("is stable across accent/case noise in the locality", () => {
    expect(clusterKey("1513", "OLAVARRÍA", 2)).toBe(clusterKey("1513", "olavarria", 2));
  });
});

describe("clusterUnassigned", () => {
  it("groups mails of the same case and counts them", () => {
    const mails = [
      mevMail("a", "Juzgado Civil y Comercial Nº 2 Olavarría", "TARTAN S.A. C/ BATTISTA JUAN CARLOS S/ COBRO EJECUTIVO -", "6564", "2026-06-01T10:00:00Z"),
      mevMail("b", "Juzgado Civil y Comercial Nº 2 Olavarría", "TARTAN S.A. C/ BATTISTA JUAN CARLOS S/ COBRO EJECUTIVO -", "6564", "2026-06-03T10:00:00Z"),
    ];
    const clusters = clusterUnassigned(mails);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toMatchObject({
      causa: "6564",
      numero: 2,
      count: 2,
    });
    expect(clusters[0].localidad).toBe("Olavarría");
    expect(clusters[0].firstDate).toBe("2026-06-01T10:00:00Z");
    expect(clusters[0].lastDate).toBe("2026-06-03T10:00:00Z");
  });

  it("keeps distinct causas in separate clusters, sorted by count desc", () => {
    const mails = [
      mevMail("a", "Juzgado Civil y Comercial Nº 2 Olavarría", "X C/ BATTISTA JUAN CARLOS S/ COBRO EJECUTIVO -", "6564"),
      mevMail("b", "Juzgado Civil y Comercial Nº 2 Olavarría", "X C/ IVROUD OSCAR ALFREDO S/ COBRO EJECUTIVO -", "839"),
      mevMail("c", "Juzgado Civil y Comercial Nº 2 Olavarría", "X C/ IVROUD OSCAR ALFREDO S/ COBRO EJECUTIVO -", "839"),
    ];
    const clusters = clusterUnassigned(mails);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].causa).toBe("839"); // count 2 first
    expect(clusters[0].count).toBe(2);
    expect(clusters[1].causa).toBe("6564");
  });

  it("clusters mojibake'd localities consistently", () => {
    // Both arrive mojibake'd ("Olavarr¡a") from the un-fixed historic sync.
    const mails = [
      mevMail("a", "Juzgado Civil y Comercial  Nº 2 Olavarr¡a", "X C/ FERREYRA GLADYS NOEMI S/ COBRO EJECUTIVO -", "836"),
      mevMail("b", "Juzgado Civil y Comercial  Nº 2 Olavarr¡a", "X C/ FERREYRA GLADYS NOEMI S/ COBRO EJECUTIVO -", "836"),
    ];
    const clusters = clusterUnassigned(mails);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(2);
    expect(clusters[0].demandado?.toLowerCase()).toContain("ferreyra");
  });

  it("drops mails with no parsed causa (non-MEV noise)", () => {
    const noise: ClusterMailInput = {
      id: "n",
      subject: "(publicidad)Te aceptaron",
      snippet: "",
      body_text: "",
      from_email: "email@market.temuemail.com",
      received_at: "2026-06-01T12:00:00Z",
    };
    expect(clusterUnassigned([noise])).toHaveLength(0);
  });

  it("picks the most frequent defendant name as the cluster label", () => {
    const mails = [
      mevMail("a", "Juzgado Civil y Comercial Nº 8 Mar del Plata", "X C/ ORTIE MICHELLE ALEJANDRA S/ SALDO -", "10336"),
      mevMail("b", "Juzgado Civil y Comercial Nº 8 Mar del Plata", "X C/ ORTIE MICHELLE ALEJANDRA S/ SALDO -", "10336"),
      mevMail("c", "Juzgado Civil y Comercial Nº 8 Mar del Plata", "", "10336"),
    ];
    const [cluster] = clusterUnassigned(mails);
    expect(cluster.demandado?.toLowerCase()).toContain("ortie");
    expect(cluster.sampleSubjects.length).toBeGreaterThan(0);
    expect(cluster.sampleSubjects.length).toBeLessThanOrEqual(2);
  });
});

describe("localidadCompatible", () => {
  it("treats two missing localities as the same noisy cluster", () => {
    expect(localidadCompatible(null, null)).toBe(true);
    expect(localidadCompatible("", "  ")).toBe(true);
  });
  it("never matches present against missing", () => {
    expect(localidadCompatible("Olavarría", null)).toBe(false);
  });
  it("matches mojibake against clean (mojibake-tolerant)", () => {
    expect(localidadCompatible("Olavarr¡a", "Olavarría")).toBe(true);
  });
});

describe("mailMatchesCluster", () => {
  const header = parseMevHeader(
    "Organismo:\tJuzgado Civil y Comercial Nº 2 Olavarr¡a\n" +
      "Carátula:\tX C/ BATTISTA JUAN CARLOS S/ COBRO EJECUTIVO -\n" +
      "Nro de causa:\t6564\n",
  );

  it("matches the same causa and a compatible (even mojibake) locality", () => {
    expect(mailMatchesCluster(header, "6564", "Olavarría")).toBe(true);
  });
  it("rejects a different causa", () => {
    expect(mailMatchesCluster(header, "6565", "Olavarría")).toBe(false);
  });
  it("rejects a different city with the same causa number", () => {
    expect(mailMatchesCluster(header, "6564", "Tandil")).toBe(false);
  });

  it("headerOfMail combines subject/snippet/body the way the matcher does", () => {
    const h = headerOfMail(mevMail("z", "Juzgado Civil y Comercial Nº 3 Dolores", "X C/ Y S/ TRANSFERENCIA -", "73068"));
    expect(h.causa).toBe("73068");
    expect(h.numero).toBe(3);
  });
});
