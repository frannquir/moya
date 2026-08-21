import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/auth";
import { getCourtIndex } from "@/lib/data/juzgados";
import {
  getConfiguredEmpresas,
  type EstudioEscritosConfig,
} from "@/lib/domain/escritos-config";
import { DemandaForm } from "./demanda-form";

export default async function IniciarDemandaPage() {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { data: estudioRow } = await supabase
    .from("estudios")
    .select("escritos_config")
    .maybeSingle();
  const config = (estudioRow?.escritos_config ?? {}) as EstudioEscritosConfig;
  const empresas = getConfiguredEmpresas(config);
  const courtIndex = await getCourtIndex(supabase);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Iniciar demanda</h1>
        <p className="text-sm text-muted-foreground">
          Carga el caso y las partes. Se guarda un borrador local mientras completás.
        </p>
      </div>
      {/* userId keys the localStorage draft: two accounts on one machine must not
          see each other's work in progress. */}
      <DemandaForm userId={user.id} courtIndex={courtIndex} empresas={empresas} />
    </div>
  );
}
