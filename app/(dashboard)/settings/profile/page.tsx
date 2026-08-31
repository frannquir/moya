import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("lawyer_profiles")
    .select("*")
    .eq("user_id", user!.id)
    .maybeSingle();

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Tu información personal. Solo es visible para vos y tu estudio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* A client component, because its action returns its errors instead of
              throwing: an invalid CUIT no longer takes the whole form with it. */}
          <ProfileForm
            initial={{
              nombre: profile?.nombre ?? "",
              matricula: profile?.matricula ?? "",
              cuit: profile?.cuit ?? "",
              legajo: profile?.legajo ?? "",
              ibm: profile?.ibm ?? "",
              domicilio_electronico: profile?.domicilio_electronico ?? "",
              telefono: profile?.telefono ?? "",
              genero: profile?.genero ?? null,
              es_abogado: profile?.es_abogado ?? false,
              iva_condicion: profile?.iva_condicion ?? "Responsable Inscripto",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
