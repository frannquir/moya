import { Lock } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Shown to a member on any estudio setting only the owner can change, so the
 * three tabs say the same sentence instead of rendering nothing.
 *
 * "Dueño del estudio", not "head": handle_new_user() sets owner_user_id and
 * role = 'head' for the same user, and nothing else assigns that role.
 */
export function SoloDueno({ children }: { children?: React.ReactNode }) {
  return (
    <Alert variant="warning">
      <Lock className="size-4" />
      <AlertDescription>
        {children ?? "Solo el dueño del estudio puede editar esta configuración."}
      </AlertDescription>
    </Alert>
  );
}
