import React from "react";

interface ScheduleFiltersBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  areaFilter: string;
  onAreaFilterChange: (value: string) => void;
  responsibleFilter: string;
  onResponsibleFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (value: string) => void;
  availableAreas: string[];
  availableResponsibles: string[];
  totalActivitiesCount: number;
  filteredActivitiesCount: number;
  onClearFilters: () => void;
}

export function ScheduleFiltersBar({
  searchTerm,
  onSearchChange,
  areaFilter,
  onAreaFilterChange,
  responsibleFilter,
  onResponsibleFilterChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  availableAreas,
  availableResponsibles,
  totalActivitiesCount,
  filteredActivitiesCount,
  onClearFilters,
}: ScheduleFiltersBarProps) {
  const hasActiveFilters =
    Boolean(searchTerm) ||
    areaFilter !== "todas" ||
    responsibleFilter !== "todos" ||
    statusFilter !== "todos" ||
    priorityFilter !== "todas";

  return (
    <div className="bg-[#0c1524] border border-blue-500/15 rounded-xl p-3 sm:p-4 space-y-3 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
        {/* Campo de Busca Rápida */}
        <div className="sm:col-span-2 md:col-span-2">
          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-semibold">
            Buscar OS / Atividade / Responsável
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-slate-500">🔍</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Digite nº da OS, nome da frente..."
              className="w-full bg-[#070c14] border border-blue-500/20 focus:border-orange-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden transition-colors font-sans"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filtro por Área Operacional */}
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-semibold">
            Área
          </label>
          <select
            value={areaFilter}
            onChange={(e) => onAreaFilterChange(e.target.value)}
            className="w-full bg-[#070c14] border border-blue-500/20 focus:border-orange-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden transition-colors cursor-pointer"
          >
            <option value="todas">Todas as áreas</option>
            {availableAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por Responsável */}
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-semibold">
            Responsável
          </label>
          <select
            value={responsibleFilter}
            onChange={(e) => onResponsibleFilterChange(e.target.value)}
            className="w-full bg-[#070c14] border border-blue-500/20 focus:border-orange-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden transition-colors cursor-pointer"
          >
            <option value="todos">Todos responsáveis</option>
            {availableResponsibles.map((resp) => (
              <option key={resp} value={resp}>
                {resp}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por Status */}
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-semibold">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="w-full bg-[#070c14] border border-blue-500/20 focus:border-orange-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden transition-colors cursor-pointer"
          >
            <option value="todos">Todos os status</option>
            <option value="programada">Programada</option>
            <option value="planejada">Planejada</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="pausada">Pausada</option>
            <option value="concluida">Concluída</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      </div>

      {/* Barra de Status dos Filtros e Limpeza */}
      <div className="flex items-center justify-between pt-2 border-t border-blue-500/10 text-xs">
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span>Exibindo:</span>
          <strong className="text-orange-400">{filteredActivitiesCount}</strong>
          <span>de {totalActivitiesCount} atividades ativas</span>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-[11px] font-mono text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>Limpar filtros</span>
            <span>✕</span>
          </button>
        )}
      </div>
    </div>
  );
}
