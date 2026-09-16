import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { formatArDate } from "@/lib/domain/dates";
import { inviteMember, removeMember } from "./actions";
import { SoloDueno } from "./solo-dueno";

export type EstudioMember = {
  user_id: string;
  email: string;
  role: "head" | "member";
  joined_at: string;
  nombre: string;
  /**
   * Both returned by get_estudio_members() since 20260822120000 /
   * 20260822130000, and both were missing from this type — which is how the
   * autorizados editor came within one cast of seeding every member as
   * "sin especificar, no abogado" while their profiles said otherwise.
   */
  genero: string | null;
  es_abogado: boolean;
};

export function MiembrosTab({
  members,
  isHead,
  currentUserId,
}: {
  members: EstudioMember[];
  isHead: boolean;
  currentUserId: string;
}) {
  return (
    <div className="space-y-4">
      {!isHead && (
        <SoloDueno>
          Solo el dueño del estudio puede invitar o quitar miembros.
        </SoloDueno>
      )}
      {isHead && (
        <Card>
          <CardHeader>
            <CardTitle>Invitar por email</CardTitle>
            <CardDescription>
              Solo se pueden agregar usuarios que ya tengan cuenta en Moya.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={inviteMember} className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="abogado@ejemplo.com"
                  required
                />
              </div>
              <Button type="submit">Agregar</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Miembros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map((m) => {
            const removable = isHead && m.role !== "head" && m.user_id !== currentUserId;
            return (
              <div
                key={m.user_id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {m.nombre || m.email}
                    </span>
                    <Badge variant={m.role === "head" ? "default" : "secondary"}>
                      {m.role === "head" ? "Dueño" : "Miembro"}
                    </Badge>
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    {m.email} · se unió {formatArDate(new Date(m.joined_at))}
                  </div>
                </div>
                {removable && (
                  <form action={removeMember.bind(null, m.user_id)}>
                    <Button type="submit" variant="outline" size="sm">
                      Quitar
                    </Button>
                  </form>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

