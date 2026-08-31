"use client";

import React, { useState } from "react";
import { Activity } from "../types/activity.types";
import { calculateStatusByProgress, validateProgress } from "../rules/activity.rules";
import { MOCK_MATERIALS } from "@/modules/materiais/types/material.types";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { updateActivityProgress } from "../services/activity.service";

interface ActivityUpdateModalProps {
  activity: Activity;
  onSave: (updatedActivity: Activity) => void;
  onClose: () => void;
}

export function ActivityUpdateModal({ activity, onSave, onClose }: ActivityUpdateModalProps) {
  const [progress, setProgress] = useState<number>(activity.progressPercentage);
  const [consumedList, setConsumedList] = useState<Array<{ id: string; materialName: string; quantity: number; unit: string }>>([]);
  const [selectedMaterialName, setSelectedMaterialName] = useState<string>(MOCK_MATERIALS[0]?.name || "Primer Epóxi Poliamida Cinza");
  const [customMaterialName, setCustomMaterialName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("L");
  const [observation, setObservation] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddMaterial = () => {
    const finalMatName = selectedMaterialName === "Outro" ? customMaterialName.trim() : selectedMaterialName;
    const qtyNum = parseFloat(quantity);

    if (!finalMatName) {
      setError("Informe o nome do material.");
      return;
    }
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError("Informe uma quantidade válida maior que 0.");
      return;
    }

    setConsumedList([
      ...consumedList,
      {
        id: `c-temp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        materialName: finalMatName,
        quantity: qtyNum,
        unit,
      },
    ]);

    setQuantity("");
    setError(null);
  };

  const handleRemoveMaterial = (id: string) => {
    setConsumedList(consumedList.filter((m) => m.id !== id));
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
    setError(null);

    if (!validateProgress(progress)) {
      setError("O progresso deve estar entre 0% e 100%.");
      return;
    }

    if (progress < activity.progressPercentage) {
      setError(`O progresso não pode ser menor que o progresso anterior (${activity.progressPercentage}%).`);
      return;
    }

    setIsSubmitting(true);
    try {
      const consumptionsPayload = consumedList.map((c) => ({
        materialName: c.materialName,
        quantity: c.quantity,
        unit: c.unit,
      }));

      const updated = await updateActivityProgress(
        activity.id,
        progress,
        consumptionsPayload,
        observation.trim() || undefined,
        photos.length > 0 ? { files: photos } : undefined
      );

      onSave(updated);
    } catch (err) {
      console.error("Erro ao salvar atualização no Supabase:", err);
      const msg = err instanceof Error ? err.message : "Erro desconhecido ao salvar atualização.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-white/10 rounded-lg p-6 max-w-lg w-full space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto text-slate-200">
        <div className="flex justify-between items-start border-b border-white/10 pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase">OS: {activity.orderNumber}</span>
            <h2 className="text-base font-bold text-slate-100 leading-snug">Atualizar Progresso & Evolução</h2>
            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{activity.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <PermissionGate permission="atividades.atualizar_progresso">
            <div className="space-y-2 bg-[#090d16] p-3.5 rounded-lg border border-white/5">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Progresso Físico Real (%)
                </label>
                <span className="text-[11px] text-slate-400 font-mono">Anterior: {activity.progressPercentage}%</span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={activity.progressPercentage}
                  max="100"
                  step="5"
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="flex-1 accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <input
                  type="number"
                  min={activity.progressPercentage}
                  max="100"
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="w-20 text-sm font-bold font-mono bg-[#0f172a] text-emerald-400 border border-white/10 rounded px-2 py-1.5 focus:border-emerald-500 focus:outline-hidden text-center"
                  required
                />
                <span className="text-sm font-bold text-slate-400 font-mono">%</span>
              </div>

              <div className="text-[11px] text-slate-400 mt-1">
                {progress === 0 && <span className="text-slate-400 font-medium font-mono">Status: PROGRAMADA</span>}
                {progress > 0 && progress < 100 && <span className="text-sky-400 font-medium font-mono">Status: EM ANDAMENTO</span>}
                {progress === 100 && <span className="text-emerald-400 font-bold font-mono">Status: CONCLUÍDA</span>}
              </div>
            </div>
          </PermissionGate>

          <PermissionGate permission="atividades.fotos.registrar">
            <div className="space-y-2 bg-[#090d16] p-3.5 rounded-lg border border-white/5">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Fotos de Evidência <span className="text-[10px] font-normal text-slate-400 lowercase">(opcional)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Anexe fotos do estado atual ({photos.length}/8 fotos).
                  </p>
                </div>
              </div>

              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                disabled={photos.length >= 8}
                className="block w-full text-[11px] text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
              />

              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {photos.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-[#0f172a] border border-white/10 px-2 py-1 rounded text-[11px] text-slate-300">
                      <span className="truncate max-w-[120px]">{p.name}</span>
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

          <PermissionGate permission="atividades.registrar_consumo">
            <div className="space-y-3 bg-[#090d16] p-3.5 rounded-lg border border-white/5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Insumos Consumidos <span className="text-[10px] font-normal text-slate-400 lowercase">(opcional)</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Apontamento de tintas e materiais aplicados em campo.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Material</label>
                  <select
                    value={selectedMaterialName}
                    onChange={(e) => setSelectedMaterialName(e.target.value)}
                    className="w-full text-xs border border-white/10 rounded px-2 py-1.5 bg-[#0f172a] text-slate-200 focus:border-emerald-500 focus:outline-hidden"
                  >
                    {MOCK_MATERIALS.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                    <option value="Outro">Outro (Especificar)</option>
                  </select>
                  {selectedMaterialName === "Outro" && (
                    <input
                      type="text"
                      value={customMaterialName}
                      onChange={(e) => setCustomMaterialName(e.target.value)}
                      placeholder="Especifique o material..."
                      className="mt-1 w-full text-xs border border-white/10 rounded px-2 py-1 bg-[#0f172a] text-slate-200 focus:border-emerald-500 focus:outline-hidden"
                    />
                  )}
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Qtd. Real</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Ex.: 12"
                    className="w-full text-xs border border-white/10 rounded px-2 py-1.5 bg-[#0f172a] text-slate-200 focus:border-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Unidade</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full text-xs border border-white/10 rounded px-1.5 py-1.5 bg-[#0f172a] text-slate-200 focus:border-emerald-500 focus:outline-hidden"
                  >
                    <option value="L">L</option>
                    <option value="kg">kg</option>
                    <option value="gl">gl</option>
                    <option value="un">un</option>
                  </select>
                </div>

                <div className="sm:col-span-1">
                  <button
                    type="button"
                    onClick={handleAddMaterial}
                    className="w-full py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {consumedList.length > 0 && (
                <div className="border border-white/10 rounded divide-y divide-white/5 text-xs bg-[#0f172a]">
                  {consumedList.map((m) => (
                    <div key={m.id} className="p-2 flex justify-between items-center">
                      <span className="font-medium text-slate-200">{m.materialName}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-emerald-400 font-bold">
                          {m.quantity} {m.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterial(m.id)}
                          className="text-rose-400 hover:text-rose-300 font-bold"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PermissionGate>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              Observações da Execução / Condições de Campo
            </label>
            <textarea
              rows={2}
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ex.: Aplicação da 2ª demão. Condições climáticas estáveis..."
              className="w-full text-xs border border-white/10 rounded px-3 py-2 bg-[#090d16] text-slate-200 focus:border-emerald-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded border border-white/10"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded shadow-[0_0_12px_-2px_rgba(16,185,129,0.5)] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Salvando..." : "Salvar Atualização"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
