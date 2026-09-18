"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BookOpenIcon,
  FolderIcon,
  HistoryIcon,
  Share2Icon,
  CoinsIcon,
  ChevronsUpDownIcon,
  LogOutIcon,
  UserIcon,
  MenuIcon,
  SunIcon,
  MoonIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { useDirection } from "@/components/ui/direction";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { signOut } from "@/actions/auth";

export function DashboardHeader({
  name,
  email,
  creditsBalance,
}: {
  name: string;
  email: string;
  creditsBalance: number;
}) {
  const pathname = usePathname();
  const tApp = useTranslations("app");
  const tSidebar = useTranslations("sidebar");
  const direction = useDirection();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  // Same mount-detection approach as ThemeToggle — resolvedTheme is unknown
  // on the server, so avoid rendering the theme item until it's known.
  const themeMounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const navItems = [
    { title: tSidebar("nav.lessons"), url: ROUTES.dashboard, icon: BookOpenIcon },
    { title: tSidebar("nav.folders"), url: ROUTES.dashboardFolders, icon: FolderIcon },
    { title: tSidebar("nav.history"), url: ROUTES.dashboardHistory, icon: HistoryIcon },
    { title: tSidebar("nav.shared"), url: ROUTES.dashboardShared, icon: Share2Icon },
  ];

  return (
    <header className="bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-4 sm:px-4">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground lg:hidden"
          onClick={() => setMobileNavOpen(true)}
        >
          <MenuIcon />
          <span className="sr-only">{tSidebar("menu")}</span>
        </Button>

        <Link href={ROUTES.dashboard} className="flex shrink-0 items-center gap-2">
          <Image src="/logo.png" alt={tApp("name")} width={32} height={32} className="rounded-full" />
          <span className="hidden font-semibold sm:inline">{tApp("name")}</span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.url;
            return (
              <Link
                key={item.url}
                href={item.url}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="size-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side={direction === "rtl" ? "right" : "left"} className="w-3/4 lg:hidden">
            <SheetHeader className="border-b border-border">
              <SheetTitle className="flex items-center gap-2">
                <Image src="/logo.png" alt={tApp("name")} width={28} height={28} className="rounded-full" />
                {tApp("name")}
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4">
              {navItems.map((item) => {
                const isActive = pathname === item.url;
                return (
                  <SheetClose
                    key={item.url}
                    render={
                      <Link
                        href={item.url}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground"
                        )}
                      />
                    }
                  >
                    <item.icon className="size-4" />
                    {item.title}
                  </SheetClose>
                );
              })}
            </nav>
            <div className="mt-auto border-t border-border p-4">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg p-1.5 text-start transition-colors hover:bg-accent/60"
                    />
                  }
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-accent text-accent-foreground">
                      {name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-start text-sm leading-tight">
                    <span className="truncate font-medium">{name}</span>
                    <span className="truncate text-xs text-muted-foreground">{email}</span>
                  </div>
                  <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-56 rounded-lg" align="end" sideOffset={8}>
                  <DropdownMenuGroup>
                    <DropdownMenuItem render={<Link href={ROUTES.dashboardProfile} />}>
                      <UserIcon data-icon="inline-start" />
                      {tSidebar("profile")}
                    </DropdownMenuItem>
                    {themeMounted && (
                      <DropdownMenuItem onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                        {resolvedTheme === "dark" ? (
                          <SunIcon data-icon="inline-start" />
                        ) : (
                          <MoonIcon data-icon="inline-start" />
                        )}
                        {resolvedTheme === "dark" ? tApp("lightMode") : tApp("darkMode")}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => signOut()}>
                      <LogOutIcon data-icon="inline-start" />
                      {tSidebar("logout")}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SheetContent>
        </Sheet>

        <div className="ms-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:ms-0 sm:gap-2">
          <Link
            href={ROUTES.dashboardCredits}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-gold-500/15 px-2.5 py-1.5 text-sm font-medium text-gold-200 transition-colors hover:bg-gold-500/25 sm:px-3"
          >
            <CoinsIcon className="size-4" />
            <span className="tabular-nums">{creditsBalance}</span>
          </Link>

          <ThemeToggle className="hidden border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground lg:inline-flex" />
          <LanguageSwitcher className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground" />

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="hidden items-center gap-1.5 rounded-lg p-1.5 transition-colors hover:bg-sidebar-accent/60 lg:flex"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                      {name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronsUpDownIcon className="hidden size-4 text-sidebar-foreground/60 lg:block" />
                </button>
              }
            />
            <DropdownMenuContent className="min-w-56 rounded-lg" align="end" sideOffset={8}>
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
                      <span className="truncate text-xs text-muted-foreground">{email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href={ROUTES.dashboardProfile} />}>
                <UserIcon data-icon="inline-start" />
                {tSidebar("profile")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => signOut()}>
                <LogOutIcon data-icon="inline-start" />
                {tSidebar("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
