import { redirect } from "next/navigation";

// Las estadísticas ahora son la página de inicio. La ruta vieja queda por los
// links guardados.
export default function EstadisticasPage() {
  redirect("/");
}
