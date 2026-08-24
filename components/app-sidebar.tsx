"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Briefcase,
  FileEdit,
  ScrollText,
  Calculator,
  Wallet,
  CreditCard,
  Receipt,
  Mail,
  Building2,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV: NavGroup[] = [
  {
    label: "Panel",
    items: [
      { title: "Inicio", href: "/", icon: LayoutDashboard },
      { title: "Estadísticas", href: "/estadisticas", icon: BarChart3 },
    ],
  },
  {
    label: "Casos",
    items: [
      { title: "Ejecutados", href: "/ejecutados", icon: Briefcase },
      { title: "Borradores", href: "/borradores", icon: FileEdit },
      { title: "Escritos", href: "/escritos", icon: ScrollText },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { title: "Liquidaciones", href: "/liquidaciones", icon: Calculator },
      { title: "Honorarios", href: "/honorarios", icon: Wallet },
      { title: "Cobros", href: "/cobros", icon: CreditCard },
      { title: "Facturas", href: "/facturas", icon: Receipt },
    ],
  },
  {
    label: "Comunicación",
    items: [{ title: "Mail", href: "/mail", icon: Mail }],
  },
  {
    label: "Estudio",
    items: [{ title: "Mi estudio", href: "/estudio", icon: Building2 }],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <Sidebar collapsible="icon">
      {/* h-14 + border-b mirrors AppHeader exactly. Left to its defaults this
          block is 60px (p-2 + py-1.5 + h-8) against the header's 56px, which put
          the logo 4px out of line with the page title and left the header's
          bottom border stopping dead at the sidebar edge. */}
      <SidebarHeader className="h-14 shrink-0 justify-center border-b px-2 py-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Briefcase className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">Moya</span>
            <span className="text-xs text-muted-foreground">Estudio</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

    </Sidebar>
  );
}