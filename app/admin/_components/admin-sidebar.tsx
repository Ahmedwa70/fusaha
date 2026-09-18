"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BookOpenIcon,
  ChevronsUpDownIcon,
  CoinsIcon,
  FileTextIcon,
  HistoryIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LayoutTemplateIcon,
  LogOutIcon,
  ShieldIcon,
  UserIcon,
  UsersIcon,
  UserCogIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDirection } from "@/components/ui/direction";
import { ROUTES } from "@/constants/routes";
import { signOut } from "@/actions/auth";
import { Permissions, type PermissionKey } from "@/constants/permissions";

export function AdminSidebar({
  name,
  email,
  permissionKeys,
  ...props
}: React.ComponentProps<typeof Sidebar> & { name: string; email: string; permissionKeys: Set<PermissionKey> }) {
  const pathname = usePathname();
  const tApp = useTranslations("app");
  const tAdmin = useTranslations("admin.sidebar");
  const tTeachers = useTranslations("admin.teachers");
  const tEmployees = useTranslations("admin.employees");
  const direction = useDirection();
  const { isMobile } = useSidebar();

  const navItems = [
    // No `permission` — always visible to anyone who cleared requireAdmin().
    { title: tAdmin("overview"), url: ROUTES.admin, icon: LayoutDashboardIcon },
    { title: tTeachers("sectionTitle"), url: ROUTES.adminTeachers, icon: UsersIcon, permission: Permissions.usersList },
    {
      title: tEmployees("sectionTitle"),
      url: ROUTES.adminEmployees,
      icon: UserCogIcon,
      permission: Permissions.employeesList,
    },
    { title: tAdmin("roles"), url: ROUTES.adminRoles, icon: ShieldIcon, permission: Permissions.rolesList },
    { title: tAdmin("lessons"), url: ROUTES.adminLessons, icon: BookOpenIcon, permission: Permissions.lessonsList },
    {
      title: tAdmin("creditPackages"),
      url: ROUTES.adminCreditPackages,
      icon: CoinsIcon,
      permission: Permissions.creditPackagesList,
    },
    {
      title: tAdmin("templates"),
      url: ROUTES.adminTemplates,
      icon: LayoutTemplateIcon,
      permission: Permissions.templatesList,
    },
    { title: tAdmin("schema"), url: ROUTES.adminSchema, icon: FileTextIcon, permission: Permissions.schemaList },
    { title: tAdmin("settings"), url: ROUTES.adminSettings, icon: KeyRoundIcon, permission: Permissions.settingsList },
    { title: tAdmin("auditLogs"), url: ROUTES.adminAuditLogs, icon: HistoryIcon, permission: Permissions.auditLogsList },
  ].filter((item) => !item.permission || permissionKeys.has(item.permission));

  return (
    <Sidebar side={direction === "rtl" ? "right" : "left"} {...props}>
      <SidebarHeader className="items-center border-b border-sidebar-border py-6 text-center">
        <Image src="/logo.png" alt={tApp("name")} width={64} height={64} className="rounded-full" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      isActive={isActive}
                      size="lg"
                      className="text-base [&_svg]:size-5"
                      render={<Link href={item.url} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                        {name.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-start text-sm leading-tight">
                      <span className="truncate font-medium">{name}</span>
                      <span className="truncate text-xs text-sidebar-foreground/70">{email}</span>
                    </div>
                    <ChevronsUpDownIcon className="ms-auto size-4" />
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent
                className="min-w-56 rounded-lg"
                side={isMobile ? "bottom" : direction === "rtl" ? "left" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                      <Avatar className="size-8 rounded-lg">
                        <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                          {name.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-start text-sm leading-tight">
                        <span className="truncate font-medium">{name}</span>
                        <span className="truncate text-xs text-sidebar-foreground/70">{email}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href={ROUTES.adminProfile} />}>
                  <UserIcon data-icon="inline-start" />
                  {tAdmin("profile")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => signOut()}>
                  <LogOutIcon data-icon="inline-start" />
                  {tAdmin("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
