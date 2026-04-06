"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Switch } from "@/components/ui/switch";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  if (isCollapsed) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={toggleTheme}
            tooltip={theme === "light" ? "Koyu Tema" : "Açık Tema"}
          >
            {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <div className="flex items-center justify-between px-2 py-1.5">
      <div className="flex items-center gap-2 text-sm">
        {theme === "light" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        <span>{theme === "light" ? "Açık Tema" : "Koyu Tema"}</span>
      </div>
      <Switch
        checked={theme === "dark"}
        onCheckedChange={toggleTheme}
      />
    </div>
  );
}
