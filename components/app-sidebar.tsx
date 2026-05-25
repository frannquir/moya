"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Briefcase,
  FileEdit,
  ScrollText,
  CalendarClock,
  Calculator,
  Wallet,
  CreditCard,
  Receipt,
  Mail,
  Building2,
  Settings,
  LogOut,
  ChevronUp,
  User,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { signOut } from "@/app/auth/actions";

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

export function AppSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
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

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip={userEmail}>
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">
                      {userEmail.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm">{userEmail}</span>
                  <ChevronUp className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                className="w-[--radix-popper-anchor-width]"
              >
                <DropdownMenuItem asChild>
                  <Link href="/settings/profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings/estudio">
                    <Settings className="mr-2 h-4 w-4" />
                    Estudio settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <form action={signOut} className="w-full">
                    <button
                      type="submit"
                      className="flex w-full items-center text-sm"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}