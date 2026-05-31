import { Suspense } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar"
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FlashToaster } from "./flash-toaster";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <SidebarProvider>
      <AppSidebar userEmail={user.email!} />
      <SidebarInset>
        <Suspense>
          <FlashToaster />
        </Suspense>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}