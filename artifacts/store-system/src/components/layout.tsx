import React from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./sidebar";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background" dir="rtl">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
            <SidebarTrigger className="ms-auto lg:hidden" />
          </header>
          <div className="flex-1 p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
