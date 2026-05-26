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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateEstudio } from "./actions";

export default async function EstudioSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("estudio_members")
    .select("role, estudio:estudios(id, nombre)")
    .eq("user_id", user!.id)
    .maybeSingle();

  const isHead = membership?.role === "head";
  const estudio = membership?.estudio;

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Estudio settings</CardTitle>
          <CardDescription>
            Manage the name and configuration of your estudio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isHead ? (
            <Alert>
              <AlertDescription>
                Only the head of your estudio can edit these settings.
              </AlertDescription>
            </Alert>
          ) : (
            <form action={updateEstudio} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del estudio</Label>
                <Input
                  id="nombre"
                  name="nombre"
                  defaultValue={estudio?.nombre ?? ""}
                  required
                />
              </div>
              <Button type="submit">Save</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}