import React from "react";

interface ActivityFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  areaFilter: string;
  onAreaChange: (area: string) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  sortOrder: "asc" | "desc";
  onSortOrderToggle: () => void;
  availableAreas: string[];
}

export function ActivityFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  areaFilter,
  onAreaChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  sortOrder,
  onSortOrderToggle,
  availableAreas,
}: ActivityFiltersProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4 shadow-xs">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Campo de Busca */}
        <div className="md:col-span-1">
          <label className="block text-xs font-mono font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
            Buscar (Nota, Nome, Tag, Resp.)
          </label>
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filtrar frentes de trabalho..."
              className="w-full text-xs bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
            />
          </div>
        </div>

        {/* Filtro por Status */}
        <div>
          <label className="block text-xs font-mono font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full text-xs bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
          >
            <option value="todos">Todos os Status</option>
            <option value="programada">Programada</option>
            <option value="planejada">Planejada</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="pausada">Pausada</option>
            <option value="concluida">Concluída</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>

        {/* Filtro por Área */}
        <div>
          <label className="block text-xs font-mono font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
            Área Operacional
          </label>
          <select
            value={areaFilter}
            onChange={(e) => onAreaChange(e.target.value)}
            className="w-full text-xs bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
          >
            <option value="todas">Todas as Áreas</option>
            {availableAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Período Planejado e Ordenação */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-3 border-t border-slate-100 items-end">
        <div>
          <label className="block text-xs font-mono font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
            Data Inicial
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full text-xs bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-mono font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
            Data Término
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full text-xs bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
          />
        </div>

        <div>
          <button
            type="button"
            onClick={onSortOrderToggle}
            className="w-full flex items-center justify-center gap-2 text-xs font-semibold px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md transition-colors"
          >
            <span>Ordem:</span>
            <span className="font-mono text-blue-700">
              {sortOrder === "asc" ? "Mais Antigas ↑" : "Mais Recentes ↓"}
            </span>
          </button>
        </div>

        <div>
          {(search || statusFilter !== "todos" || areaFilter !== "todas" || startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                onSearchChange("");
                onStatusChange("todos");
                onAreaChange("todas");
                onStartDateChange("");
                onEndDateChange("");
              }}
              className="w-full text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 py-2 px-3 rounded-md transition-colors"
            >
              Limpar Filtros ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
