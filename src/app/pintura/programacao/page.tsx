"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useActivities } from "@/modules/atividades/hooks/useActivities";
import { ActivityDetails } from "@/modules/atividades/components/ActivityDetails";
import { ActivityForm } from "@/modules/atividades/components/ActivityForm";
import { Activity } from "@/modules/atividades/types/activity.types";
import { getWeekInfo, formatDateISO } from "@/modules/atividades/utils/week.utils";
import {
  getMonthCalendarGrid,
  calculateRescheduledDates,
} from "@/modules/atividades/utils/schedule.utils";
import { ScheduleWeeklyView } from "@/modules/atividades/components/schedule/ScheduleWeeklyView";
import { ScheduleMonthlyView } from "@/modules/atividades/components/schedule/ScheduleMonthlyView";
import { ScheduleFiltersBar } from "@/modules/atividades/components/schedule/ScheduleFiltersBar";
import { RescheduleModal } from "@/modules/atividades/components/schedule/RescheduleModal";
import { batchRescheduleActivities } from "@/modules/atividades/services/schedule.service";
import { usePermissions } from "@/hooks/usePermissions";

type ScheduleViewMode = "semana" | "mes";

interface PendingChange {
  activityId: string;
  newStartDate: string;
  newEndDate: string;
  oldStartDate: string;
  oldEndDate: string;
  durationDays: number;
}

export default function ProgramacaoPage() {
  const {
    rawActivities,
    selectedActivity,
    setSelectedActivity,
    isLoading,
    error: activitiesError,
    updateActivity,
    archiveActivity,
  } = useActivities();

  const { canRescheduleActivities } = usePermissions();

  // Estado da visão atual: "semana" ou "mes"
  const [viewMode, setViewMode] = useState<ScheduleViewMode>("semana");

  // Estado da data de referência para navegação temporal
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  // Modo de Edição e Alterações Pendentes (Map por activityId)
  const [isEditMode, setIsEditMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [batchFeedback, setBatchFeedback] = useState<{ tipo: "sucesso" | "erro"; msg: string } | null>(null);
  const [justificationInput, setJustificationInput] = useState("");
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);

  // Modal Acessível/Mobile para alterar data sem arrastar
  const [mobileRescheduleActivity, setMobileRescheduleActivity] = useState<Activity | null>(null);

  // Filtros Operacionais
  const [searchTerm, setSearchTerm] = useState("");
  const [areaFilter, setAreaFilter] = useState("todas");
  const [responsibleFilter, setResponsibleFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [priorityFilter, setPriorityFilter] = useState("todas");

  // Informações da Semana e do Mês
  const weekInfo = useMemo(() => getWeekInfo(referenceDate, false), [referenceDate]);
  const monthInfo = useMemo(() => getMonthCalendarGrid(referenceDate), [referenceDate]);

  // Lista de Áreas e Responsáveis disponíveis para os filtros
  const availableAreas = useMemo(() => {
    const set = new Set<string>();
    rawActivities.forEach((a) => {
      if (a.location?.area) set.add(a.location.area);
    });
    return Array.from(set).sort();
  }, [rawActivities]);

  const availableResponsibles = useMemo(() => {
    const set = new Set<string>();
    rawActivities.forEach((a) => {
      if (a.assignedTo) set.add(a.assignedTo);
    });
    return Array.from(set).sort();
  }, [rawActivities]);

  // Atividades filtradas pela busca e filtros
  const filteredActivities = useMemo(() => {
    return rawActivities.filter((act) => {
      // Busca rápida
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesOS = act.orderNumber.toLowerCase().includes(term);
        const matchesName = act.name.toLowerCase().includes(term);
        const matchesResp = act.assignedTo?.toLowerCase().includes(term) ?? false;
        const matchesArea = act.location?.area?.toLowerCase().includes(term) ?? false;
        if (!matchesOS && !matchesName && !matchesResp && !matchesArea) return false;
      }

      // Filtro por Área
      if (areaFilter !== "todas" && act.location?.area !== areaFilter) {
        return false;
      }

      // Filtro por Responsável
      if (responsibleFilter !== "todos" && act.assignedTo !== responsibleFilter) {
        return false;
      }

      // Filtro por Status
      if (statusFilter !== "todos" && act.status !== statusFilter) {
        return false;
      }

      // Filtro por Prioridade
      if (priorityFilter !== "todas" && act.priority !== priorityFilter) {
        return false;
      }

      return true;
    });
  }, [rawActivities, searchTerm, areaFilter, responsibleFilter, statusFilter, priorityFilter]);

  // Controles de Navegação Temporal
  const handlePrevious = () => {
    setReferenceDate((prev) => {
      const nextDate = new Date(prev);
      if (viewMode === "semana") {
        nextDate.setDate(nextDate.getDate() - 7);
      } else {
        nextDate.setMonth(nextDate.getMonth() - 1);
      }
      return nextDate;
    });
  };

  const handleNext = () => {
    setReferenceDate((prev) => {
      const nextDate = new Date(prev);
      if (viewMode === "semana") {
        nextDate.setDate(nextDate.getDate() + 7);
      } else {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
      return nextDate;
    });
  };

  const handleToday = () => {
    setReferenceDate(new Date());
  };

  // Drag and Drop: Mover atividade para um dia específico preservando duração
  const handleDropActivityOnDay = useCallback(
    (activityId: string, targetDayStr: string) => {
      const act = rawActivities.find((a) => a.id === activityId);
      if (!act) return;

      // Se a atividade já estiver concluída ou cancelada, não permite mover
      if (act.status === "concluida" || act.status === "cancelada") {
        setBatchFeedback({
          tipo: "erro",
          msg: `A OS ${act.orderNumber} está com status "${act.status.toUpperCase()}" e não pode ser reprogramada.`,
        });
        return;
      }

      const currentStart = act.schedule.plannedStartDate;
      const currentEnd = act.schedule.plannedEndDate;

      const { newStartDate, newEndDate, durationDays } = calculateRescheduledDates(
        currentStart,
        currentEnd,
        targetDayStr
      );

      setPendingChanges((prev) => {
        const nextMap = new Map(prev);
        // Se voltou para a data original, remove do mapa de alterações pendentes
        if (newStartDate === currentStart && newEndDate === currentEnd) {
          nextMap.delete(activityId);
        } else {
          nextMap.set(activityId, {
            activityId,
            newStartDate,
            newEndDate,
            oldStartDate: currentStart,
            oldEndDate: currentEnd,
            durationDays,
          });
        }
        return nextMap;
      });

      setBatchFeedback(null);
    },
    [rawActivities]
  );

  // Ação Mobile/Acessível de Reprogramação
  const handleConfirmMobileReschedule = (newStartDate: string, newEndDate: string) => {
    if (!mobileRescheduleActivity) return;
    const act = mobileRescheduleActivity;

    setPendingChanges((prev) => {
      const nextMap = new Map(prev);
      if (newStartDate === act.schedule.plannedStartDate && newEndDate === act.schedule.plannedEndDate) {
        nextMap.delete(act.id);
      } else {
        nextMap.set(act.id, {
          activityId: act.id,
          newStartDate,
          newEndDate,
          oldStartDate: act.schedule.plannedStartDate,
          oldEndDate: act.schedule.plannedEndDate,
          durationDays: 1,
        });
      }
      return nextMap;
    });

    setMobileRescheduleActivity(null);
    setBatchFeedback(null);
  };

  // Cancelar Modo de Edição e descartar alterações locais
  const handleCancelEditMode = () => {
    setPendingChanges(new Map());
    setIsEditMode(false);
    setBatchFeedback(null);
    setShowSaveConfirmModal(false);
  };

  // Abrir confirmação de salvamento
  const handleRequestSave = () => {
    if (pendingChanges.size === 0) {
      setIsEditMode(false);
      return;
    }
    setShowSaveConfirmModal(true);
  };

  // Salvar alterações atômicas no Supabase
  const handleConfirmSaveBatch = async () => {
    if (pendingChanges.size === 0) return;

    setIsSavingBatch(true);
    setBatchFeedback(null);

    try {
      const itemsToReschedule = Array.from(pendingChanges.values()).map((p) => ({
        activityId: p.activityId,
        newStartDate: p.newStartDate,
        newEndDate: p.newEndDate,
        oldStartDate: p.oldStartDate,
        oldEndDate: p.oldEndDate,
      }));

      const res = await batchRescheduleActivities(itemsToReschedule, justificationInput);

      if (res.sucesso) {
        setBatchFeedback({
          tipo: "sucesso",
          msg: `${res.totalReprogramadas} ${
            res.totalReprogramadas === 1 ? "atividade reprogramada" : "atividades reprogramadas"
          } com sucesso no banco de dados e auditoria gravada.`,
        });
        setPendingChanges(new Map());
        setIsEditMode(false);
        setShowSaveConfirmModal(false);
        setJustificationInput("");
      } else {
        setBatchFeedback({
          tipo: "erro",
          msg: res.mensagem || "Falha ao salvar reprogramação no banco de dados.",
        });
      }
    } catch (err: any) {
      console.error("[ProgramacaoPage] Erro ao salvar alterações em lote:", err);
      setBatchFeedback({
        tipo: "erro",
        msg: err.message || "Erro inesperado ao salvar programação no banco de dados.",
      });
    } finally {
      setIsSavingBatch(false);
    }
  };

  const handleStartEditModal = (act: Activity) => {
    setEditingActivity(act);
  };

  const handleSaveEditModal = async (updated: Activity) => {
    await updateActivity(updated);
    setEditingActivity(null);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setAreaFilter("todas");
    setResponsibleFilter("todos");
    setStatusFilter("todos");
    setPriorityFilter("todas");
  };

  return (
    <div className="space-y-5">
      {/* 1. CABEÇALHO DO PLANNER OPERACIONAL */}
      <div className="border-b border-blue-500/15 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Planejador Operacional
            </h1>
            <span className="text-[10px] uppercase font-mono font-bold bg-orange-500/15 border border-orange-500/30 text-orange-400 px-2 py-0.5 rounded">
              RSS3 Planner
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Visão temporal unificada, alocação de equipes e reprogramação rápida de frentes de pintura.
          </p>
        </div>

        {/* Barra de Controles: Alternador Semana/Mês + Navegação + Modo de Edição */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Seletor de Visão: [ Semana ] [ Mês ] */}
          <div className="flex items-center bg-[#070c14] border border-blue-500/20 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setViewMode("semana")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                viewMode === "semana"
                  ? "bg-blue-600 text-white shadow-xs font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setViewMode("mes")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                viewMode === "mes"
                  ? "bg-blue-600 text-white shadow-xs font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Mês
            </button>
          </div>

          {/* Navegação Temporal: [ ← ] [ Hoje ] [ → ] */}
          <div className="flex items-center bg-[#070c14] border border-blue-500/20 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={handlePrevious}
              title={viewMode === "semana" ? "Semana anterior" : "Mês anterior"}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-blue-500/10 border-r border-blue-500/20 transition-colors cursor-pointer"
            >
              ←
            </button>
            <button
              type="button"
              onClick={handleToday}
              title="Ir para o período atual"
              className="px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-blue-500/10 transition-colors cursor-pointer"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={handleNext}
              title={viewMode === "semana" ? "Próxima semana" : "Próximo mês"}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-blue-500/10 border-l border-blue-500/20 transition-colors cursor-pointer"
            >
              →
            </button>
          </div>

          {/* Badge de Rótulo do Período */}
          <span className="text-xs font-mono font-bold px-3 py-1.5 bg-blue-500/15 border border-blue-500/30 text-blue-300 rounded-lg shadow-xs">
            {viewMode === "semana" ? weekInfo.label : monthInfo.label}
          </span>

          {/* Botão de Ativação do Modo de Edição (condicionado à permissão atividades.reprogramar) */}
          {canRescheduleActivities && !isEditMode && (
            <button
              type="button"
              onClick={() => setIsEditMode(true)}
              className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-[0_0_12px_rgba(249,115,22,0.35)] flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <span>✏️</span>
              <span>Editar programação</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. BARRA FIXA DO MODO DE EDIÇÃO (quando ativo) */}
      {isEditMode && (
        <div className="p-3.5 bg-[#121c2d] border-2 border-orange-500/70 rounded-xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-orange-500 animate-ping" />
            <div>
              <div className="flex items-center gap-2">
                <strong className="text-xs font-bold text-white uppercase tracking-wider">
                  Modo de Edição Ativo
                </strong>
                <span className="text-[10px] font-mono font-bold bg-orange-500 text-white px-2 py-0.5 rounded-full">
                  {pendingChanges.size}{" "}
                  {pendingChanges.size === 1 ? "alteração pendente" : "alterações pendentes"}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Arraste os cards para o dia desejado. A duração das frentes é preservada automaticamente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleCancelEditMode}
              disabled={isSavingBatch}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleRequestSave}
              disabled={isSavingBatch || pendingChanges.size === 0}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>Salvar alterações</span>
              <span>✓</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. FEEDBACK VISUAL DE SUCESSO OU ERRO */}
      {batchFeedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between ${
            batchFeedback.tipo === "sucesso"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <span>{batchFeedback.msg}</span>
          <button
            type="button"
            onClick={() => setBatchFeedback(null)}
            className="text-slate-400 hover:text-white ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {activitiesError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-mono">
          {activitiesError}
        </div>
      )}

      {/* 4. BARRA DE FILTROS OPERACIONAIS E BUSCA RÁPIDA */}
      <ScheduleFiltersBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        areaFilter={areaFilter}
        onAreaFilterChange={setAreaFilter}
        responsibleFilter={responsibleFilter}
        onResponsibleFilterChange={setResponsibleFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        availableAreas={availableAreas}
        availableResponsibles={availableResponsibles}
        totalActivitiesCount={rawActivities.length}
        filteredActivitiesCount={filteredActivities.length}
        onClearFilters={handleClearFilters}
      />

      {/* 5. ÁREA DAS VISÕES (SEMANAL / MENSAL) E PAINEL LATERAL DE DETALHES */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-slate-400 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping mr-2" />
          Carregando programação operacional do Supabase...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Coluna Principal da Grade */}
          <div className={selectedActivity ? "lg:col-span-3 space-y-4" : "lg:col-span-4 space-y-4"}>
            {viewMode === "semana" ? (
              <ScheduleWeeklyView
                weekInfo={weekInfo}
                activities={filteredActivities}
                selectedActivity={selectedActivity}
                isEditMode={isEditMode}
                pendingChanges={pendingChanges}
                onSelectActivity={setSelectedActivity}
                onDropActivityOnDay={handleDropActivityOnDay}
                onOpenMobileReschedule={setMobileRescheduleActivity}
              />
            ) : (
              <ScheduleMonthlyView
                monthInfo={monthInfo}
                activities={filteredActivities}
                selectedActivity={selectedActivity}
                isEditMode={isEditMode}
                pendingChanges={pendingChanges}
                onSelectActivity={setSelectedActivity}
                onDropActivityOnDay={handleDropActivityOnDay}
                onOpenMobileReschedule={setMobileRescheduleActivity}
              />
            )}
          </div>

          {/* Painel Lateral com Detalhes da Atividade Selecionada */}
          {selectedActivity && (
            <div className="lg:col-span-1 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-blue-500/15">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400">
                  Painel de Detalhes
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedActivity(null)}
                  className="text-slate-400 hover:text-white text-xs p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <ActivityDetails
                activity={selectedActivity}
                onUpdateActivity={updateActivity}
                onStartEdit={handleStartEditModal}
                onArchiveActivity={archiveActivity}
                onClose={() => setSelectedActivity(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* 6. MODAL DE REPROGRAMAÇÃO ACESSÍVEL / MOBILE */}
      {mobileRescheduleActivity && (
        <RescheduleModal
          activity={mobileRescheduleActivity}
          currentStartDate={
            pendingChanges.get(mobileRescheduleActivity.id)?.newStartDate ||
            mobileRescheduleActivity.schedule.plannedStartDate
          }
          currentEndDate={
            pendingChanges.get(mobileRescheduleActivity.id)?.newEndDate ||
            mobileRescheduleActivity.schedule.plannedEndDate
          }
          onConfirm={handleConfirmMobileReschedule}
          onClose={() => setMobileRescheduleActivity(null)}
        />
      )}

      {/* 7. MODAL DE CONFIRMAÇÃO DE SALVAMENTO EM LOTE */}
      {showSaveConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0c1524] border border-blue-500/25 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-blue-500/15">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>Confirmar Reprogramação em Lote</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSaveConfirmModal(false)}
                className="text-slate-400 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                Você está prestes a persistir atomicamente{" "}
                <strong className="text-orange-400 font-mono">
                  {pendingChanges.size} {pendingChanges.size === 1 ? "alteração" : "alterações"}
                </strong>{" "}
                de datas no banco de dados com histórico de auditoria.
              </p>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-semibold">
                  Motivo / Justificativa da Reprogramação (opcional):
                </label>
                <input
                  type="text"
                  value={justificationInput}
                  onChange={(e) => setJustificationInput(e.target.value)}
                  placeholder="Ex: Ajuste de alocação de equipe, chuva, chegada de material..."
                  className="w-full bg-[#070c14] border border-blue-500/20 focus:border-orange-500 rounded-lg p-2 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-[#070c14] rounded-lg border border-blue-500/15 font-mono text-[11px]">
                {Array.from(pendingChanges.values()).map((p) => {
                  const act = rawActivities.find((a) => a.id === p.activityId);
                  return (
                    <div key={p.activityId} className="flex justify-between text-slate-300">
                      <span className="text-blue-300 font-bold">{act?.orderNumber}</span>
                      <span>
                        {p.oldStartDate} → <strong className="text-orange-400">{p.newStartDate}</strong>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-500/15">
              <button
                type="button"
                onClick={() => setShowSaveConfirmModal(false)}
                disabled={isSavingBatch}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveBatch}
                disabled={isSavingBatch}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
              >
                {isSavingBatch ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Confirmar e Salvar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL DE EDIÇÃO COMPLETA DE ATIVIDADE */}
      {editingActivity && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-medium)] rounded-xl p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl transition-colors duration-200">
            <ActivityForm
              initialActivity={editingActivity}
              onSave={handleSaveEditModal}
              onCancel={() => setEditingActivity(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

