import Link from "next/link";

export default function SelecaoAreaPage() {
  const areas = [
    {
      id: "pintura",
      name: "Pintura Industrial",
      category: "OPERAÇÃO PRINCIPAL",
      description: "Controle operacional de tratamento de superfícies, aplicação de esquemas de pintura, apontamentos de campo, inspeções e gestão de insumos técnicos.",
      active: true,
      href: "/pintura",
    },
  ];

  return (
    <main className="min-h-screen bg-[#070c14] p-6 sm:p-12 flex flex-col items-center justify-center relative">
      <div className="max-w-xl w-full space-y-6">
        {/* Cabeçalho de Seleção */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-orange-500/15 border border-orange-500/40 text-orange-500 font-extrabold text-xl mb-2 shadow-[0_0_15px_-3px_rgba(249,115,22,0.4)]">
            RSS3
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            SOLUÇÕES INDUSTRIAIS
          </h1>
          <p className="text-sm text-blue-400 font-mono">
            Selecione a frente de trabalho operacional para prosseguir.
          </p>
        </div>

        {/* Lista de Frentes */}
        <div className="space-y-3">
          {areas.map((area) => (
            <Link
              key={area.id}
              href={area.href}
              className="block p-5 bg-[#0c1524] border border-blue-500/20 rounded-xl hover:border-orange-500/50 hover:shadow-[0_0_20px_-5px_rgba(249,115,22,0.3)] transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      {area.category}
                    </span>
                    <h2 className="text-base font-bold text-white group-hover:text-orange-400 transition-colors">
                      {area.name}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    {area.description}
                  </p>
                </div>
                <span className="text-blue-400 group-hover:text-orange-400 text-xl font-bold pl-4 transition-colors">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center pt-4 border-t border-blue-500/15">
          <p className="text-[11px] text-slate-400 font-mono">
            RSS3 Soluções Industriais • Pintura, Hidrojato, Andaime, Isolamento, Civil
          </p>
        </div>
      </div>
    </main>
  );
}
