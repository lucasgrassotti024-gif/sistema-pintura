import Link from "next/link";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function SelecaoAreaPage() {
  const areas = [
    {
      id: "pintura",
      name: "Pintura",
      description: "Controle operacional de tratamento de superfícies, aplicação de tintas, inspeções e consumo de insumos.",
      active: true,
      href: "/pintura",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-6 sm:p-12 flex flex-col items-center justify-center relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-xl w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white font-bold text-lg mb-2">
            SP
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Seleção de Área Operacional
          </h1>
          <p className="text-sm text-slate-500">
            Selecione a frente de trabalho para acessar o módulo operacional correspondente.
          </p>
        </div>

        <div className="space-y-3">
          {areas.map((area) => (
            <Link
              key={area.id}
              href={area.href}
              className="block p-5 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900 group-hover:text-blue-600">
                      {area.name}
                    </h2>
                    <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                      Disponível
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {area.description}
                  </p>
                </div>
                <span className="text-slate-400 group-hover:text-blue-600 text-lg font-bold pl-4">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
