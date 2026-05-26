import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateLawyerProfile } from "./actions";

const IVA_OPTIONS = [
  "Responsable Inscripto",
  "Monotributista",
  "Exento",
  "Consumidor Final",
];

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
          <form action={updateLawyerProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input id="nombre" name="nombre" defaultValue={profile?.nombre ?? ""} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="matricula">Matrícula</Label>
                <Input id="matricula" name="matricula" defaultValue={profile?.matricula ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cuit">CUIT</Label>
                <Input id="cuit" name="cuit" defaultValue={profile?.cuit ?? ""} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="legajo">Legajo</Label>
                <Input id="legajo" name="legajo" defaultValue={profile?.legajo ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ibm">IBM</Label>
                <Input id="ibm" name="ibm" defaultValue={profile?.ibm ?? ""} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="domicilio_electronico">Domicilio electrónico</Label>
              <Input
                id="domicilio_electronico"
                name="domicilio_electronico"
                type="email"
                defaultValue={profile?.domicilio_electronico ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input id="telefono" name="telefono" type="tel" defaultValue={profile?.telefono ?? ""} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="iva_condicion">Condición frente al IVA</Label>
              <Select
                name="iva_condicion"
                defaultValue={profile?.iva_condicion ?? "Responsable Inscripto"}
              >
                <SelectTrigger id="iva_condicion">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IVA_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2">
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}