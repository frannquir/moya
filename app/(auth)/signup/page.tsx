import Link from "next/link";
import { signup, signInWithGoogle } from "@/app/auth/actions";
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
  UserIcon,
} from "../parts";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Crear cuenta
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Empezá a usar Moya en menos de un minuto.
        </p>
      </div>

      {error && <AuthError message={error} />}

      <form action={signup} className="space-y-4">
        <div>
          <Label htmlFor="nombre" className="mb-1.5 text-sm font-medium">
            Nombre y apellido
          </Label>
          <InputIcon
            id="nombre"
            name="nombre"
            type="text"
            placeholder="Fran Quiroga"
            icon={<UserIcon />}
          />
        </div>

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
            minLength={6}
            placeholder="Mínimo 8 caracteres"
            icon={<LockIcon />}
          />
          <p className="text-muted-foreground mt-1.5 text-[11px]">
            Mínimo 8 caracteres.
          </p>
        </div>

        <RippleButton type="submit" className="h-[42px] w-full font-semibold">
          Crear cuenta
          <ArrowIcon />
        </RippleButton>
      </form>

      <AuthDivider />

      <form action={signInWithGoogle}>
        <GoogleButton />
      </form>

      <p className="text-muted-foreground mt-6 text-center text-[12.5px] leading-relaxed">
        Al crear tu cuenta aceptás los{" "}
        <Link href="#" className="hover:text-foreground underline">
          Términos
        </Link>{" "}
        y la{" "}
        <Link href="#" className="hover:text-foreground underline">
          Política de privacidad
        </Link>
        .
      </p>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </>
  );
}
