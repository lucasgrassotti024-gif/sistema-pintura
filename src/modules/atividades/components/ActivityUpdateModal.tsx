"use client";

import React, { useState, useEffect, useRef } from "react";
import { Activity } from "../types/activity.types";
import { validateProgress } from "../rules/activity.rules";
import { Material } from "@/modules/materiais/types/material.types";
import { getMaterials } from "@/modules/materiais/services/material.service";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { updateActivityProgress } from "../services/activity.service";

interface ActivityUpdateModalProps {
  activity: Activity;
  onSave: (updatedActivity: Activity) => void;
  onClose: () => void;
}

interface PlannedConsumptionRow {
  plannedMaterialId?: string;
  materialId?: string;
  materialName: string;
  unit: string;
  alreadyConsumed: number;
  newConsumption: string; // string para controle do input
}

interface ExtraConsumptionRow {
  id: string;
  materialId?: string;
  materialName: string;
  unit: string;
  alreadyConsumed: number;
  newConsumption: string;
}

export function ActivityUpdateModal({ activity, onSave, onClose }: ActivityUpdateModalProps) {
  // 1. Progresso Físico Real: inicializa rigorosamente com o valor salvo na atividade
  const [progress, setProgress] = useState<number>(activity.progressPercentage);

  // 2. Linhas de Materiais Planejados (com consumo histórico calculado)
  const [plannedRows, setPlannedRows] = useState<PlannedConsumptionRow[]>([]);

  // 3. Materiais Extras adicionados nesta atualização
  const [extraRows, setExtraRows] = useState<ExtraConsumptionRow[]>([]);

  // 4. Catálogo para inclusão de material extra
  const [catalogMaterials, setCatalogMaterials] = useState<Material[]>([]);
  const [selectedExtraMaterial, setSelectedExtraMaterial] = useState<string>("");
  const [customExtraName, setCustomExtraName] = useState<string>("");
  const [extraQty, setExtraQty] = useState<string>("");
  const [extraUnit, setExtraUnit] = useState<string>("L");
  const [showAddExtra, setShowAddExtra] = useState<boolean>(false);

  // 5. Outros campos (observação, fotos)
  const [observation, setObservation] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Proteção contra duplo clique/concorrência e chave de idempotência estável por tentativa
  const isSubmittingRef = useRef(false);
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  // Inicialização e montagem do estado com base na atividade
  useEffect(() => {
    // A. Progresso
    setProgress(activity.progressPercentage);

    // B. Mapear consumos históricos por materialId e por nome (case insensitive)
    const consumptionsByMatId = new Map<string, number>();
    const consumptionsByName = new Map<string, number>();

    (activity.consumptions || []).forEach((c) => {
      const qty = Number(c.quantity) || 0;
      if (c.materialId) {
        const prev = consumptionsByMatId.get(c.materialId) || 0;
        consumptionsByMatId.set(c.materialId, prev + qty);
      }
      const normName = c.materialName.trim().toLowerCase();
      const prevName = consumptionsByName.get(normName) || 0;
      consumptionsByName.set(normName, prevName + qty);
    });

    // C. Montar linhas dos materiais planejados vinculados à atividade
    const planned = activity.plannedMaterials || [];
    const rows: PlannedConsumptionRow[] = planned.map((pm) => {
      let hist = 0;
      if (pm.materialId && consumptionsByMatId.has(pm.materialId)) {
        hist = consumptionsByMatId.get(pm.materialId) || 0;
      } else {
        const norm = pm.materialName.trim().toLowerCase();
        hist = consumptionsByName.get(norm) || 0;
      }

      return {
        plannedMaterialId: pm.id,
        materialId: pm.materialId,
        materialName: pm.materialName,
        unit: pm.unit || "L",
        alreadyConsumed: hist,
        newConsumption: "",
      };
    });

    setPlannedRows(rows);
    setExtraRows([]);
  }, [activity]);

  // Carregar catálogo de materiais para opções de insumos extras
  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      try {
        const mats = await getMaterials();
        if (isMounted) {
          const activeMats = mats.filter((m) => m.active);
          setCatalogMaterials(activeMats);
          if (activeMats.length > 0) {
            setSelectedExtraMaterial(activeMats[0].name);
            setExtraUnit(activeMats[0].unit || "L");
          }
        }
      } catch (err) {
        console.warn("Aviso ao carregar catálogo para insumos extras:", err);
      }
    }
    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  const handlePlannedQtyChange = (index: number, val: string) => {
    setPlannedRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, newConsumption: val } : row))
    );
  };

  const handleAddExtraMaterial = () => {
    const isOther = selectedExtraMaterial === "Outro";
    const finalName = isOther ? customExtraName.trim() : selectedExtraMaterial.trim();
    const qtyNum = parseFloat(extraQty);

    if (!finalName) {
      setError("Informe o nome do material adicional.");
      return;
    }
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError("Informe uma quantidade válida maior que zero.");
      return;
    }

    // Verificar se já está nas linhas planejadas ou extras
    const alreadyInPlanned = plannedRows.some(
      (r) => r.materialName.toLowerCase() === finalName.toLowerCase()
    );
    if (alreadyInPlanned) {
      setError(`O material "${finalName}" já está listado nos materiais planejados.`);
      return;
    }

    const alreadyInExtra = extraRows.some(
      (r) => r.materialName.toLowerCase() === finalName.toLowerCase()
    );
    if (alreadyInExtra) {
      setError(`O material "${finalName}" já foi adicionado na lista.`);
      return;
    }

    const foundInCatalog = catalogMaterials.find(
      (m) => m.name.toLowerCase() === finalName.toLowerCase()
    );

    // Calcular histórico se houver consumos anteriores desse material avulso na OS
    let hist = 0;
    (activity.consumptions || []).forEach((c) => {
      if (
        (foundInCatalog && c.materialId === foundInCatalog.id) ||
        c.materialName.trim().toLowerCase() === finalName.toLowerCase()
      ) {
        hist += Number(c.quantity) || 0;
      }
    });

    setExtraRows([
      ...extraRows,
      {
        id: `extra-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        materialId: foundInCatalog?.id,
        materialName: finalName,
        unit: extraUnit,
        alreadyConsumed: hist,
        newConsumption: String(qtyNum),
      },
    ]);

    setExtraQty("");
    setCustomExtraName("");
    setShowAddExtra(false);
    setError(null);
  };

  const handleRemoveExtraRow = (id: string) => {
    setExtraRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleExtraQtyChange = (id: string, val: string) => {
    setExtraRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, newConsumption: val } : r))
    );
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);

    if (photos.length + selectedFiles.length > 8) {
      setError("Limite máximo de 8 fotos por atualização.");
      return;
    }

    for (const f of selectedFiles) {
      if (f.size > 5242880) {
        setError(`A foto "${f.name}" excede o limite de 5 MB.`);
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        setError(`Formato de "${f.name}" inválido. Permitido: JPG, PNG, WEBP.`);
        return;
      }
    }

    setPhotos([...photos, ...selectedFiles]);
    setError(null);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    if (!validateProgress(progress)) {
      setError("O progresso deve estar entre 0% e 100%.");
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    if (progress < activity.progressPercentage) {
      setError(`O progresso não pode ser menor que o progresso anterior (${activity.progressPercentage}%).`);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    // Coletar SOMENTE os novos consumos informados nesta atualização
    const consumptionsPayload: Array<{ materialName: string; quantity: number; unit: string }> = [];

    // Validar consumos planejados
    for (const row of plannedRows) {
      const trimmed = row.newConsumption.trim();
      if (trimmed !== "") {
        const qtyNum = parseFloat(trimmed);
        if (isNaN(qtyNum) || qtyNum < 0) {
          setError(`Quantidade inválida para o material "${row.materialName}". O valor deve ser maior ou igual a zero.`);
          isSubmittingRef.current = false;
          setIsSubmitting(false);
          return;
        }
        if (qtyNum > 0) {
          consumptionsPayload.push({
            materialName: row.materialName,
            quantity: qtyNum,
            unit: row.unit,
          });
        }
      }
    }

    // Validar consumos extras
    for (const row of extraRows) {
      const trimmed = row.newConsumption.trim();
      if (trimmed !== "") {
        const qtyNum = parseFloat(trimmed);
        if (isNaN(qtyNum) || qtyNum <= 0) {
          setError(`Quantidade inválida para o material extra "${row.materialName}".`);
          isSubmittingRef.current = false;
          setIsSubmitting(false);
          return;
        }
        consumptionsPayload.push({
          materialName: row.materialName,
          quantity: qtyNum,
          unit: row.unit,
        });
      }
    }

    try {
      // Envia a chave estável da operação via RPC atômica
      const updated = await updateActivityProgress(
        activity.id,
        progress,
        consumptionsPayload,
        observation.trim() || undefined,
        photos.length > 0 ? { files: photos } : undefined,
        idempotencyKeyRef.current
      );

      // Sucesso na submissão: gera uma nova chave para futuras operações
      idempotencyKeyRef.current = crypto.randomUUID();
      onSave(updated);
    } catch (err) {
      console.error("Erro ao salvar atualização no Supabase:", err);
      const msg = err instanceof Error ? err.message : "Erro desconhecido ao salvar atualização.";
      setError(msg);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#0b121f] border border-blue-500/20 rounded-xl p-6 max-w-2xl w-full space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto text-slate-200">
        {/* Cabeçalho */}
        <div className="flex justify-between items-start border-b border-blue-500/15 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wider">
                OS: {activity.orderNumber}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Pintura Industrial
              </span>
            </div>
            <h2 className="text-base font-bold text-white leading-snug mt-1">
              Atualizar Progresso & Apontamentos
            </h2>
            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{activity.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none px-2 py-1 rounded hover:bg-white/5 transition-colors"
            title="Fechar"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300 font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* SEÇÃO 1: PROGRESSO FÍSICO */}
          <PermissionGate permission="atividades.atualizar_progresso">
            <div className="space-y-2.5 bg-[#070c14] p-4 rounded-lg border border-blue-500/15">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Progresso Físico Real (%)
                </label>
                <span className="text-xs text-slate-400 font-mono">
                  Anterior: <strong className="text-blue-400">{activity.progressPercentage}%</strong>
                </span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={activity.progressPercentage}
                  max="100"
                  step="5"
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="flex-1 accent-orange-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={activity.progressPercentage}
                    max="100"
                    value={progress}
                    onChange={(e) => setProgress(Number(e.target.value))}
                    className="w-20 text-sm font-bold font-mono bg-[#0c1524] text-orange-400 border border-blue-500/30 rounded px-2 py-1.5 focus:border-orange-500 focus:outline-hidden text-center"
                    required
                  />
                  <span className="text-sm font-bold text-slate-400 font-mono">%</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] pt-1">
                <span className="text-slate-500">Arraste para avançar ou digite o valor exato</span>
                <div>
                  {progress === 0 && (
                    <span className="text-slate-400 font-semibold font-mono">Status: PROGRAMADA</span>
                  )}
                  {progress > 0 && progress < 100 && (
                    <span className="text-sky-400 font-semibold font-mono">Status: EM ANDAMENTO</span>
                  )}
                  {progress === 100 && (
                    <span className="text-emerald-400 font-bold font-mono">Status: CONCLUÍDA</span>
                  )}
                </div>
              </div>
            </div>
          </PermissionGate>

          {/* SEÇÃO 2: INSUMOS CONSUMIDOS */}
          <PermissionGate permission="atividades.registrar_consumo">
            <div className="space-y-3 bg-[#070c14] p-4 rounded-lg border border-blue-500/15">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Insumos Consumidos
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Informe somente a quantidade consumida <strong className="text-slate-300">nesta atualização</strong>. O saldo histórico é mantido imutável.
                  </p>
                </div>
                {!showAddExtra && (
                  <button
                    type="button"
                    onClick={() => setShowAddExtra(true)}
                    className="text-[11px] font-semibold text-orange-400 hover:text-orange-300 underline"
                  >
                    + Outro Insumo
                  </button>
                )}
              </div>

              {/* Tabela de Insumos Planejados */}
              {plannedRows.length > 0 ? (
                <div className="overflow-x-auto border border-blue-500/15 rounded-md bg-[#0c1524]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#090f1a] text-slate-400 uppercase text-[10px] tracking-wider border-b border-blue-500/15 font-mono">
                      <tr>
                        <th className="py-2.5 px-3">Material Planejado</th>
                        <th className="py-2.5 px-3 text-right">Já consumido</th>
                        <th className="py-2.5 px-3 text-center w-32">Novo consumo</th>
                        <th className="py-2.5 px-2 text-center w-12">Un.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-500/10">
                      {plannedRows.map((row, idx) => (
                        <tr key={row.plannedMaterialId || idx} className="hover:bg-blue-500/5">
                          <td className="py-2.5 px-3 font-medium text-slate-200">
                            {row.materialName}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                            {row.alreadyConsumed.toFixed(2)} {row.unit}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.newConsumption}
                              onChange={(e) => handlePlannedQtyChange(idx, e.target.value)}
                              placeholder="0.00"
                              className="w-24 text-right text-xs font-mono font-bold bg-[#070c14] text-orange-400 border border-blue-500/30 rounded px-2 py-1 focus:border-orange-500 focus:outline-hidden"
                            />
                          </td>
                          <td className="py-2.5 px-2 text-center text-slate-400 font-mono">
                            {row.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3 border border-dashed border-blue-500/20 rounded bg-[#0c1524] text-center text-xs text-slate-400">
                  Nenhum material foi planejado na criação desta atividade.
                </div>
              )}

              {/* Insumos Extras Adicionados */}
              {extraRows.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    Insumos Extras Informados:
                  </span>
                  <div className="overflow-x-auto border border-orange-500/20 rounded-md bg-[#0c1524]">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#090f1a] text-slate-400 uppercase text-[10px] tracking-wider border-b border-blue-500/15 font-mono">
                        <tr>
                          <th className="py-2 px-3">Material Extra</th>
                          <th className="py-2 px-3 text-right">Já consumido</th>
                          <th className="py-2 px-3 text-center w-32">Novo consumo</th>
                          <th className="py-2 px-2 text-center w-12">Un.</th>
                          <th className="py-2 px-2 text-center w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-500/10">
                        {extraRows.map((row) => (
                          <tr key={row.id} className="hover:bg-blue-500/5">
                            <td className="py-2 px-3 font-medium text-slate-200">
                              {row.materialName}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-400">
                              {row.alreadyConsumed.toFixed(2)} {row.unit}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={row.newConsumption}
                                onChange={(e) => handleExtraQtyChange(row.id, e.target.value)}
                                className="w-24 text-right text-xs font-mono font-bold bg-[#070c14] text-orange-400 border border-blue-500/30 rounded px-2 py-1 focus:border-orange-500 focus:outline-hidden"
                              />
                            </td>
                            <td className="py-2 px-2 text-center text-slate-400 font-mono">
                              {row.unit}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveExtraRow(row.id)}
                                className="text-rose-400 hover:text-rose-300 font-bold"
                                title="Remover linha"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Formulário Compacto para Adicionar Insumo Extra */}
              {showAddExtra && (
                <div className="p-3 border border-orange-500/30 rounded-lg bg-[#0c1524] space-y-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-orange-400">Adicionar Insumo Adicional</span>
                    <button
                      type="button"
                      onClick={() => setShowAddExtra(false)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                    <div className="sm:col-span-6">
                      <label className="block text-[10px] font-medium text-slate-400 mb-1">Material</label>
                      <select
                        value={selectedExtraMaterial}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedExtraMaterial(val);
                          const found = catalogMaterials.find((m) => m.name === val);
                          if (found) setExtraUnit(found.unit || "L");
                        }}
                        className="w-full text-xs border border-blue-500/20 rounded px-2 py-1.5 bg-[#070c14] text-slate-200 focus:border-orange-500 focus:outline-hidden"
                      >
                        {catalogMaterials.map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                        <option value="Outro">Outro (Especificar)</option>
                      </select>
                      {selectedExtraMaterial === "Outro" && (
                        <input
                          type="text"
                          value={customExtraName}
                          onChange={(e) => setCustomExtraName(e.target.value)}
                          placeholder="Nome do material..."
                          className="mt-1 w-full text-xs border border-blue-500/20 rounded px-2 py-1 bg-[#070c14] text-slate-200 focus:border-orange-500 focus:outline-hidden"
                        />
                      )}
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-medium text-slate-400 mb-1">Qtd. Nova</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={extraQty}
                        onChange={(e) => setExtraQty(e.target.value)}
                        placeholder="0.00"
                        className="w-full text-xs border border-blue-500/20 rounded px-2 py-1.5 bg-[#070c14] text-slate-200 focus:border-orange-500 focus:outline-hidden font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-medium text-slate-400 mb-1">Unidade</label>
                      <select
                        value={extraUnit}
                        onChange={(e) => setExtraUnit(e.target.value)}
                        className="w-full text-xs border border-blue-500/20 rounded px-1.5 py-1.5 bg-[#070c14] text-slate-200 focus:border-orange-500 focus:outline-hidden"
                      >
                        <option value="L">L</option>
                        <option value="kg">kg</option>
                        <option value="gl">gl</option>
                        <option value="un">un</option>
                        <option value="m²">m²</option>
                      </select>
                    </div>

                    <div className="sm:col-span-1">
                      <button
                        type="button"
                        onClick={handleAddExtraMaterial}
                        className="w-full py-1.5 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </PermissionGate>

          {/* SEÇÃO 3: FOTOS DE EVIDÊNCIA */}
          <PermissionGate permission="atividades.fotos.registrar">
            <div className="space-y-2 bg-[#070c14] p-4 rounded-lg border border-blue-500/15">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Fotos de Evidência <span className="text-[10px] font-normal text-slate-400 lowercase">(opcional)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Anexe fotos do estado atual da pintura ({photos.length}/8 fotos).
                  </p>
                </div>
              </div>

              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                disabled={photos.length >= 8}
                className="block w-full text-[11px] text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#0c1524] file:text-slate-200 hover:file:bg-blue-500/20 file:border-blue-500/20 cursor-pointer"
              />

              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {photos.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-[#0c1524] border border-blue-500/20 px-2 py-1 rounded text-[11px] text-slate-300">
                      <span className="truncate max-w-[140px]">{p.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="text-rose-400 hover:text-rose-300 font-bold ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PermissionGate>

          {/* SEÇÃO 4: OBSERVAÇÕES */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              Observações da Execução / Condições de Campo
            </label>
            <textarea
              rows={2}
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ex.: Aplicação da 2ª demão concluída. Condições climáticas estáveis..."
              className="w-full text-xs border border-blue-500/20 rounded px-3 py-2 bg-[#070c14] text-slate-200 focus:border-orange-500 focus:outline-hidden"
            />
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-blue-500/15">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 rounded border border-blue-500/20 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded shadow-[0_0_15px_-3px_rgba(249,115,22,0.4)] transition-all disabled:opacity-50 active:scale-95"
            >
              {isSubmitting ? "Salvando..." : "Salvar Atualização"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

