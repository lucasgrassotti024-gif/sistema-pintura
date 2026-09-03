import React, { useState } from "react";
import { Activity } from "../types/activity.types";
import { ActivityStatusBadge } from "./ActivityStatusBadge";
import { ActivityPriorityBadge } from "./ActivityPriorityBadge";
import { ActivityProgress } from "./ActivityProgress";
import { ActivityUpdateModal } from "./ActivityUpdateModal";
import { CancelActivityModal } from "./CancelActivityModal";
import { ArchiveActivityModal } from "./ArchiveActivityModal";
import { PermanentDeleteActivityModal } from "./PermanentDeleteActivityModal";
import { GeneratePdfModal } from "./GeneratePdfModal";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { isActivityDelayed, canEditActivity } from "../rules/activity.rules";

interface ActivityDetailsProps {
  activity: Activity;
  onUpdateActivity?: (updated: Activity) => void;
  onStartEdit?: (activity: Activity) => void;
  onArchiveActivity?: (activityId: string, reason?: string) => Promise<void> | void;
  onDeletePermanently?: (activityId: string) => Promise<void> | void;
  allowPermanentDelete?: boolean;
  onClose?: () => void;
}

export function ActivityDetails({
  activity,
  onUpdateActivity,
  onStartEdit,
  onArchiveActivity,
  onDeletePermanently,
  allowPermanentDelete = false,
  onClose,
}: ActivityDetailsProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeletingPermanently, setIsDeletingPermanently] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const delayed = isActivityDelayed(activity);
  const isCancelled = activity.status === "cancelada";
  const isCompleted = activity.status === "concluida";
  const isArchived = Boolean(activity.archivedAt);
  const editable = canEditActivity(activity) && !isArchived;

  const handleSaveUpdate = (updated: Activity) => {
    onUpdateActivity?.(updated);
    setIsUpdating(false);
    setIsCancelling(false);
  };

  const handleConfirmArchive = async (activityId: string, reason?: string) => {
    if (onArchiveActivity) {
      await onArchiveActivity(activityId, reason);
    }
    setIsArchiving(false);
    onClose?.();
  };

  const handleConfirmPermanentDelete = async (activityId: string) => {
    if (onDeletePermanently) {
      await onDeletePermanently(activityId);
    }
    setIsDeletingPermanently(false);
    onClose?.();
  };

  return (
    <div
      className={`bg-[#0c1524] border rounded-lg p-5 space-y-4 shadow-xl transition-all ${
        isCancelled ? "border-rose-500/30 bg-[#0c1524]" : "border-blue-500/20"
      }`}
    >
      {/* 1. CABEÇALHO */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <span className="text-xs font-mono font-bold text-blue-400 tracking-wider">
            {activity.orderNumber}
          </span>
          <h3 className="text-base font-bold text-white mt-0.5 leading-snug">
            {activity.name}
          </h3>
        </div>

        {/* Botão Fechar no Canto Superior Direito */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 rounded border border-blue-500/20 transition-colors"
          >
            Fechar
          </button>
        )}
      </div>

      {/* 2. ÁREA DE AÇÕES */}
      <div className="flex items-center gap-2 flex-wrap border-b border-blue-500/15 pb-3 pt-1">
        {/* Editar Atividade */}
        {editable && !isCompleted && onStartEdit && (
          <PermissionGate permission="atividades.editar">
            <button
              type="button"
              onClick={() => onStartEdit(activity)}
              className="text-xs font-semibold px-2.5 py-1 bg-[#070c14] hover:bg-blue-500/15 text-slate-200 rounded border border-blue-500/20 hover:border-blue-500/40 transition-colors"
            >
              Editar
            </button>
          </PermissionGate>
        )}

        {/* Arquivar Atividade */}
        {!isArchived && (
          <PermissionGate permission="atividades.arquivar">
            <button
              type="button"
              onClick={() => setIsArchiving(true)}
              className="text-xs font-semibold px-2.5 py-1 bg-[#070c14] hover:bg-blue-500/15 text-slate-300 rounded border border-blue-500/20 hover:border-blue-500/40 transition-colors"
            >
              Arquivar
            </button>
          </PermissionGate>
        )}

        {/* Excluir Definitivamente */}
        {allowPermanentDelete && onDeletePermanently && (
          <PermissionGate permission="atividades.excluir">
            <button
              type="button"
              onClick={() => setIsDeletingPermanently(true)}
              className="text-xs font-semibold px-2.5 py-1 bg-[#070c14] hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 rounded border border-rose-500/30 hover:border-rose-500/50 transition-colors"
            >
              Excluir definitivamente
            </button>
          </PermissionGate>
        )}

        {/* Gerar PDF */}
        <button
          type="button"
          onClick={() => setIsGeneratingPdf(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-[#070c14] hover:bg-blue-500/15 text-blue-400 rounded border border-blue-500/30 hover:border-blue-500/50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Gerar PDF</span>
        </button>
      </div>

      {/* 3. STATUS E PRIORIDADE */}
      <div className="flex items-center gap-2 flex-wrap">
        {isArchived ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono uppercase tracking-wider bg-[#070c14] text-slate-300 border border-blue-500/20 select-none cursor-default">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Arquivada
          </span>
        ) : (
          <ActivityStatusBadge status={activity.status} />
        )}
        <ActivityPriorityBadge priority={activity.priority} />
        {delayed && !isArchived && !isCompleted && !isCancelled && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30 font-medium select-none cursor-default">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Em Atraso
          </span>
        )}
      </div>

      {/* 4. INFORMAÇÕES PRINCIPAIS */}
      <div className="bg-[#070c14] border border-blue-500/15 rounded-md p-3.5 space-y-2 text-xs">
        <div className="flex justify-between items-center py-0.5 border-b border-blue-500/10">
          <span className="text-slate-400 font-mono">Área:</span>
          <span className="font-semibold text-slate-200">{activity.location.area || "-"}</span>
        </div>
        <div className="flex justify-between items-center py-0.5 border-b border-blue-500/10">
          <span className="text-slate-400 font-mono">Local específico:</span>
          <span className="font-semibold text-slate-200">{activity.location.local || "-"}</span>
        </div>
        {activity.location.equipment && (
          <div className="flex justify-between items-center py-0.5 border-b border-blue-500/10">
            <span className="text-slate-400 font-mono">Equipamento:</span>
            <span className="font-semibold text-slate-200">{activity.location.equipment}</span>
          </div>
        )}
        {activity.assignedTo && (
          <div className="flex justify-between items-center py-0.5">
            <span className="text-slate-400 font-mono">Responsável:</span>
            <span className="font-semibold text-slate-200">{activity.assignedTo}</span>
          </div>
        )}
      </div>

      {/* 4.1. MATERIAIS PLANEJADOS & CONSUMO */}
      {activity.plannedMaterials && activity.plannedMaterials.length > 0 && (
        <div className="bg-[#070c14] border border-blue-500/15 rounded-md p-3.5 space-y-2 text-xs">
          <div className="flex justify-between items-center border-b border-blue-500/10 pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 font-mono">
              Insumos & Consumo
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {activity.plannedMaterials.length} planejado(s)
            </span>
          </div>

          <div className="space-y-1.5 pt-0.5">
            {activity.plannedMaterials.map((pm, idx) => {
              // Calcular consumo do material na atividade
              const consumedQty = (activity.consumptions || []).reduce((acc, c) => {
                const matchId = pm.materialId && c.materialId && pm.materialId === c.materialId;
                const matchName = pm.materialName.trim().toLowerCase() === c.materialName.trim().toLowerCase();
                return matchId || matchName ? acc + Number(c.quantity) : acc;
              }, 0);

              return (
                <div
                  key={pm.id || idx}
                  className="flex justify-between items-center text-[11px] py-1 border-b border-white/5 last:border-0"
                >
                  <span className="font-medium text-slate-300 truncate max-w-[150px]" title={pm.materialName}>
                    {pm.materialName}
                  </span>
                  <div className="font-mono text-right space-x-1.5">
                    <span className="text-orange-400 font-bold">
                      {consumedQty.toFixed(1)}
                    </span>
                    <span className="text-slate-500">/</span>
                    <span className="text-slate-400">
                      {pm.quantity} {pm.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. PROGRESSO */}
      <div className="space-y-2 pt-1">
        <ActivityProgress currentProgress={activity.progressPercentage} />
      </div>

      {/* 6. AÇÃO OPERACIONAL PRINCIPAL */}
      {editable && (
        <div className="pt-2">
          <PermissionGate permission={["atividades.atualizar_progresso", "atividades.registrar_consumo"]}>
            <button
              type="button"
              onClick={() => setIsUpdating(true)}
              className="w-full text-xs font-bold py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded shadow-[0_0_15px_-3px_rgba(249,115,22,0.4)] transition-all active:scale-[0.99]"
            >
              Atualizar Progresso / Apontamentos
            </button>
          </PermissionGate>
        </div>
      )}

      {/* Modais de Ação */}
      {isUpdating && (
        <ActivityUpdateModal
          activity={activity}
          onSave={handleSaveUpdate}
          onClose={() => setIsUpdating(false)}
        />
      )}

      {isCancelling && (
        <CancelActivityModal
          activity={activity}
          onConfirmCancel={handleSaveUpdate}
          onClose={() => setIsCancelling(false)}
        />
      )}

      {isArchiving && (
        <ArchiveActivityModal
          activity={activity}
          onConfirmArchive={handleConfirmArchive}
          onClose={() => setIsArchiving(false)}
        />
      )}

      {isDeletingPermanently && (
        <PermanentDeleteActivityModal
          activity={activity}
          onConfirmDelete={handleConfirmPermanentDelete}
          onClose={() => setIsDeletingPermanently(false)}
        />
      )}

      {isGeneratingPdf && (
        <GeneratePdfModal
          activity={activity}
          onClose={() => setIsGeneratingPdf(false)}
        />
      )}
    </div>
  );
}
