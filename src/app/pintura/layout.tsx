import type { Metadata } from "next";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";

export const metadata: Metadata = {
  title: "Pintura Industrial | RSS3 Soluções Industriais",
  description: "Módulo operacional do Sistema de Pintura Industrial - RSS3 Soluções Industriais",
};

export default function PinturaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex antialiased transition-colors duration-200">
      {/* 1. SIDEBAR DE NAVEGAÇÃO */}
      <AppSidebar />

      {/* 2. ÁREA PRINCIPAL COM HEADER E CONTEÚDO */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-64 transition-all duration-200">
        <AppHeader />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
