import Image from "next/image";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-4 sm:px-6">
      <Image src="/book-transparent.png" alt="فصحاء" width={112} height={60} priority className="h-10 w-auto object-contain" />
      <div className="flex items-center gap-2"><ThemeToggle /><LanguageSwitcher /></div>
    </header>
  );
}
