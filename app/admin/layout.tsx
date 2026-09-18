import { AdminSidebar } from "@/app/admin/_components/admin-sidebar";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireAdmin, getRolePermissionKeys } from "@/lib/auth/dal";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const permissionKeys = await getRolePermissionKeys(admin.roleId);

  return (
    <SidebarProvider>
      <AdminSidebar name={admin.name} email={admin.email} permissionKeys={permissionKeys} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
          <SidebarTrigger />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
