import Link from "next/link";
import { login, signInWithGoogle } from "@/app/auth/actions";
import { Label } from "@/components/ui/label";
import { InputIcon } from "../input-icon";
import { RippleButton } from "../ripple-button";
import {
  ArrowIcon,
  AuthDivider,
  AuthError,
  GoogleButton,
  LockIcon,
  MailIcon,
} from "../parts";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Iniciar sesión
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Bienvenido de nuevo.</p>
      </div>

      {error && <AuthError message={error} />}

      <form action={login} className="space-y-4">
        <div>
          <Label htmlFor="email" className="mb-1.5 text-sm font-medium">
            Email
          </Label>
          <InputIcon
            id="email"
            name="email"
            type="email"
            required
            placeholder="tu@estudio.com"
            icon={<MailIcon />}
          />
        </div>

        <div>
          <Label htmlFor="password" className="mb-1.5 text-sm font-medium">
            Contraseña
          </Label>
          <InputIcon
            id="password"
            name="password"
            type="password"
            required
            placeholder="••••••••"
            icon={<LockIcon />}
          />
        </div>

        <RippleButton type="submit" className="h-[42px] w-full font-semibold">
          Iniciar sesión
          <ArrowIcon />
        </RippleButton>
      </form>

      <AuthDivider />

      <form action={signInWithGoogle}>
        <GoogleButton />
      </form>

      <p className="text-muted-foreground mt-8 text-center text-sm">
        ¿No tenés cuenta?{" "}
        <Link href="/signup" className="text-primary font-medium hover:underline">
          Crear cuenta
        </Link>
      </p>
    </>
  );
}
