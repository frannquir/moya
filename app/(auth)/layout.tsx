import Link from "next/link";
import "./auth.css";

// Persistent shell for /login and /signup. The brand panel stays mounted across
// client navigation between the two pages, so only the form area swaps -- that
// IS the transition (the form re-runs auth-form-in via template.tsx).
//
// Per the project decision, the brand panel uses ONE shared headline (the login
// mockup's) to keep the persistent-panel animation simple.
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen">
      {/* ============== DESKTOP / TABLET (md+) ============== */}
      <div className="hidden min-h-screen md:grid md:grid-cols-2">
        {/* Brand panel (left) */}
        <aside className="brand-panel relative flex flex-col justify-between p-10 text-white">
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20 backdrop-blur">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M20 7L9 18l-5-5" />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="font-heading text-xl font-semibold">Moya</div>
              <div className="text-xs text-white/60">
                Gestión de estudios jurídicos
              </div>
            </div>
          </div>

          <div className="relative z-10 max-w-md">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] tracking-[0.14em] text-white/70 uppercase">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--accent)" }}
              />
              Gestión jurídica
            </div>
            <h2 className="font-heading text-4xl leading-[1.05] font-semibold tracking-tight">
              Tu estudio.
              <br />
              Tus ejecutados.
              <br />
              <span style={{ color: "var(--accent)" }}>
                Todo en un solo lugar.
              </span>
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/70">
              Liquidaciones, escritos, mail y honorarios — sincronizados y al
              día. Pensado para abogados que trabajan en equipo.
            </p>
          </div>

          <div className="relative z-10 flex items-center justify-between text-xs text-white/50">
            <span>© 2026 Moya</span>
            <div className="flex gap-4">
              <Link href="#" className="hover:text-white/80">
                Términos
              </Link>
              <Link href="#" className="hover:text-white/80">
                Privacidad
              </Link>
            </div>
          </div>
        </aside>

        {/* Form panel (right) */}
        <main className="bg-background flex items-center justify-center p-6 lg:p-12">
          {children}
        </main>
      </div>

      {/* ============== MOBILE (< md) ============== */}
      <div className="flex min-h-screen flex-col md:hidden">
        <header className="brand-panel px-6 pt-10 pb-16 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20 backdrop-blur">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M20 7L9 18l-5-5" />
              </svg>
            </div>
            <span className="font-heading text-lg font-semibold">Moya</span>
          </div>
          <p className="relative z-10 mt-6 max-w-xs font-heading text-2xl leading-tight font-semibold">
            Tu estudio. Tus ejecutados.{" "}
            <span style={{ color: "var(--accent)" }}>Todo en un lugar.</span>
          </p>
        </header>

        <main className="bg-background -mt-8 flex-1 rounded-t-2xl px-6 pt-8 pb-10 shadow-2xl">
          {children}
        </main>
      </div>
    </div>
  );
}
