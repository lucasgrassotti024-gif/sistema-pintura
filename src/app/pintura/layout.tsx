import React from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { SidebarProvider } from "@/context/SidebarContext";

export default function PinturaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="min-h-screen bg-[#070c14] text-slate-100 flex">
        {/* Sidebar Lateral RSS3 */}
        <AppSidebar />

        {/* Área Principal de Conteúdo */}
        <div className="flex-1 flex flex-col min-w-0 w-full">
          <AppHeader />
          <main className="flex-1 p-3.5 sm:p-5 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
