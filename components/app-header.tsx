"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronDown, LogOut, User } from "lucide-react";

import { signOut } from "@/app/auth/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The title shown beside the sidebar trigger. Derived from the path rather than
 * threaded down from each page, so a new route gets a sensible header without
 * having to remember to pass one. Detail routes fall back to their section name
 * — the page's own <h1> already carries the case name, and repeating it in the
 * header would say the same thing twice.
 */
const SECTIONS: { prefix: string; label: string }[] = [
  { prefix: "/ejecutados", label: "Ejecutados" },
  { prefix: "/borradores", label: "Borradores" },
  { prefix: "/escritos", label: "Escritos" },
  { prefix: "/liquidaciones", label: "Liquidaciones" },
  { prefix: "/honorarios", label: "Honorarios" },
  { prefix: "/cobros", label: "Cobros" },
  { prefix: "/facturas", label: "Facturas" },
  { prefix: "/mail", label: "Mail" },
  { prefix: "/estudio", label: "Mi estudio" },
  { prefix: "/estadisticas", label: "Estadísticas" },
  { prefix: "/settings/profile", label: "Perfil" },
  { prefix: "/settings", label: "Configuración" },
];

function sectionFor(pathname: string): string {
  if (pathname === "/") return "Inicio";
  // Longest prefix wins, so /settings/profile does not resolve to /settings.
  const hit = [...SECTIONS]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((s) => pathname === s.prefix || pathname.startsWith(`${s.prefix}/`));
  return hit?.label ?? "Moya";
}

/**
 * The dashboard's top bar. It owns the account menu and the theme toggle, which
 * used to live in the sidebar footer — a collapsed sidebar hid them, and the
 * theme control in particular has to be reachable at all times.
 *
 * Sticky, because the ejecutado pages are long and the account/theme controls
 * should not require scrolling back to the top.
 */
export function AppHeader({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const initials = userEmail.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <SidebarTrigger className="-ml-1" />

      {/* No vertical rule between the trigger and the title. shadcn's dashboard
          block puts one there, but that layout has breadcrumbs to separate from;
          here the title is two words, so a 1px x 16px mark floating in a 56px bar
          read as a speck rather than as structure (Fran, 2026-08-24). The
          header's gap-2 does the separating, and the sidebar's own border is
          already a vertical line 40px to the left. */}
      <span className="font-heading text-sm font-medium">{sectionFor(pathname)}</span>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <Avatar className="size-6">
                <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
              </Avatar>
              {/* The address is long and the header is not the place for it on a
                  phone; the dropdown label below always shows it in full. */}
              <span className="hidden max-w-[16rem] truncate text-sm sm:inline">
                {userEmail}
              </span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <p className="text-xs text-muted-foreground">Sesión iniciada como</p>
              <p className="truncate text-sm font-medium">{userEmail}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href="/settings/profile">
                <User className="mr-2 size-4" />
                Mi perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/estudio">
                <Building2 className="mr-2 size-4" />
                Configuración del estudio
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem asChild variant="destructive">
              {/* A server action needs a POST, so this is a form and not a link
                  (gotcha #14). */}
              <form action={signOut} className="w-full">
                <button type="submit" className="flex w-full items-center text-sm">
                  <LogOut className="mr-2 size-4" />
                  Cerrar sesión
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
