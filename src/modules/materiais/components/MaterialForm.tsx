"use client";

import React, { useState } from "react";
import { Material, NewMaterialInput } from "../types/material.types";

interface MaterialFormProps {
  initialMaterial?: Material | null;
  onSave: (material: NewMaterialInput & { active?: boolean }) => Promise<void> | void;
  onCancel: () => void;
}

const PRESET_MATERIAL_TYPES = [
  "Fundo Epóxi",
  "Acabamento PU",
  "Alta Temperatura",
  "Solvente / Diluente",
  "Demarcação Viária",
  "Primer Rico em Zinco",
  "Massa Epóxi",
  "Outro",
];

const PRESET_LOCATIONS = [
  "Almoxarifado A - Prateleira 01",
  "Almoxarifado A - Prateleira 02",
  "Almoxarifado A - Prateleira 03",
  "Almoxarifado B - Piso",
  "Almoxarifado Químico",
  "Outro",
];

export function MaterialForm({ initialMaterial, onSave, onCancel }: MaterialFormProps) {
  const isEditing = Boolean(initialMaterial);

  // Identificação
  const [name, setName] = useState(initialMaterial?.name || "");
  const [code, setCode] = useState(initialMaterial?.code || "");
  const [type, setType] = useState(() => {
    if (!initialMaterial) return PRESET_MATERIAL_TYPES[0];
    return PRESET_MATERIAL_TYPES.includes(initialMaterial.type) ? initialMaterial.type : "Outro";
  });
  const [customType, setCustomType] = useState(() => {
    if (!initialMaterial) return "";
    return PRESET_MATERIAL_TYPES.includes(initialMaterial.type) ? "" : initialMaterial.type;
  });
  const [manufacturer, setManufacturer] = useState(initialMaterial?.manufacturer || "");
  const [color, setColor] = useState(initialMaterial?.color || "");
  const [unit, setUnit] = useState(initialMaterial?.unit || "L");
  const [active, setActive] = useState(initialMaterial?.active ?? true);

  // Configuração de Estoque Mínimo
  const [minimumStock, setMinimumStock] = useState(
    initialMaterial?.minimumStock !== undefined ? String(initialMaterial.minimumStock) : ""
  );
  const [location, setLocation] = useState(() => {
    if (!initialMaterial?.location) return PRESET_LOCATIONS[0];
    return PRESET_LOCATIONS.includes(initialMaterial.location) ? initialMaterial.location : "Outro";
  });
  const [customLocation, setCustomLocation] = useState(() => {
    if (!initialMaterial?.location) return "";
    return PRESET_LOCATIONS.includes(initialMaterial.location) ? "" : initialMaterial.location;
  });

  // Informações Técnicas
  const [technicalInfo, setTechnicalInfo] = useState(initialMaterial?.technicalInfo || "");

  // Validação
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalName = name.trim();
    const finalCode = code.trim().toUpperCase();
    const finalType = type === "Outro" ? customType.trim() : type;
    const finalLocation = location === "Outro" ? customLocation.trim() : location;

    if (!finalName) {
      setError("O Nome do material é obrigatório.");
      return;
    }
    if (!finalCode) {
      setError("O Código do material é obrigatório.");
      return;
    }
    if (!finalType) {
      setError("O Tipo do material é obrigatório.");
      return;
    }
    if (minimumStock === "" || isNaN(Number(minimumStock)) || Number(minimumStock) < 0) {
      setError("Informe um Estoque Mínimo válido (maior ou igual a 0).");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        code: finalCode,
        name: finalName,
        type: finalType,
        manufacturer: manufacturer.trim() || undefined,
        color: color.trim() || undefined,
        unit,
        minimumStock: Number(minimumStock),
        location: finalLocation || undefined,
        technicalInfo: technicalInfo.trim() || undefined,
        active,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar material.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#0c1524] border border-blue-500/20 rounded-lg p-6 max-w-2xl w-full space-y-6 shadow-2xl">
      <div className="flex justify-between items-start border-b border-blue-500/15 pb-4">
        <div>
          <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider">
            Catálogo de Insumos RSS3
          </span>
          <h2 className="text-lg font-bold text-white leading-snug">
            {isEditing ? `Editar Material: ${initialMaterial?.code}` : "Cadastrar Novo Material"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-400 hover:text-white px-3 py-1.5 bg-[#070c14] hover:bg-blue-500/15 rounded border border-blue-500/20 transition-colors"
        >
          Cancelar
        </button>
      </div>

      {/* Alerta explicativo */}
      <div className="bg-blue-500/10 border border-blue-500/25 p-3 rounded text-xs text-blue-200">
        <p className="font-semibold text-blue-300">
          {isEditing ? "Edição de Dados Cadastrais:" : "Cadastro de Catálogo:"}
        </p>
        <p className="text-blue-200/80 text-[11px] mt-0.5">
          {isEditing ? (
            <>
              Esta ação altera apenas as especificações técnicas do material. O saldo atual em estoque (<strong>{initialMaterial?.currentStock} {initialMaterial?.unit}</strong>) não é alterado e não gera movimentações físicas.
            </>
          ) : (
            <>
              Esta ação cadastra a especificação técnica do material. O saldo inicial começará em <strong>0 {unit}</strong>. Para adicionar unidades físicas, utilize o botão <em>+ Adicionar Material</em> após o cadastro.
            </>
          )}
        </p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded font-mono">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Identificação */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Código do Material *
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ex: MAT-EPOXI-05"
              className="w-full bg-[#070c14] text-white border border-blue-500/20 rounded px-3 py-2 focus:ring-1 focus:ring-orange-500 focus:outline-hidden font-mono uppercase"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Nome Comercial / Especificação *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Tinta Epóxi de Alta Espessura Cinza"
              className="w-full bg-[#070c14] text-white border border-blue-500/20 rounded px-3 py-2 focus:ring-1 focus:ring-orange-500 focus:outline-hidden"
              required
            />
          </div>
        </div>

        {/* Tipo, Fabricante, Cor e Unidade */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Tipo / Família *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-[#070c14] text-white border border-blue-500/20 rounded px-3 py-2 focus:ring-1 focus:ring-orange-500 focus:outline-hidden"
            >
              {PRESET_MATERIAL_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {type === "Outro" && (
              <input
                type="text"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Especifique o tipo..."
                className="w-full mt-2 bg-[#070c14] text-white border border-blue-500/20 rounded px-3 py-1.5 focus:ring-1 focus:ring-orange-500 focus:outline-hidden"
                required
              />
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Fabricante</label>
            <input
              type="text"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="Ex: WEG, Renner, Sherwin"
              className="w-full bg-[#070c14] text-white border border-blue-500/20 rounded px-3 py-2 focus:ring-1 focus:ring-orange-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Cor / Padrão</label>
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Ex: Munsell N 6,5"
              className="w-full bg-[#070c14] text-white border border-blue-500/20 rounded px-3 py-2 focus:ring-1 focus:ring-orange-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Unidade de Medida *</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full bg-[#070c14] text-white border border-blue-500/20 rounded px-3 py-2 focus:ring-1 focus:ring-orange-500 focus:outline-hidden font-mono"
            >
              <option value="L">Litros (L)</option>
              <option value="kg">Quilogramas (kg)</option>
              <option value="gal">Galão (gal)</option>
              <option value="un">Unidade (un)</option>
            </select>
          </div>
        </div>

        {/* Estoque Mínimo e Localização */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Estoque Mínimo de Segurança *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={minimumStock}
              onChange={(e) => setMinimumStock(e.target.value)}
              placeholder="Ex: 50"
              className="w-full bg-[#070c14] text-white border border-blue-500/20 rounded px-3 py-2 focus:ring-1 focus:ring-orange-500 focus:outline-hidden font-mono"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Localização no Almoxarifado</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-[#070c14] text-white border border-blue-500/20 rounded px-3 py-2 focus:ring-1 focus:ring-orange-500 focus:outline-hidden"
            >
              {PRESET_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            {location === "Outro" && (
              <input
                type="text"
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="Especifique o local..."
                className="w-full mt-2 bg-[#070c14] text-white border border-blue-500/20 rounded px-3 py-1.5 focus:ring-1 focus:ring-orange-500 focus:outline-hidden"
                required
              />
            )}
          </div>
        </div>

        {/* Informações Técnicas */}
        <div>
          <label className="block font-semibold text-slate-300 mb-1">
            Informações Técnicas / Aplicação
          </label>
          <textarea
            value={technicalInfo}
            onChange={(e) => setTechnicalInfo(e.target.value)}
            rows={3}
            placeholder="Ex: Utilizar catalisador na proporção 4:1. Tempo de secagem ao toque: 2 horas."
            className="w-full bg-[#070c14] text-white border border-blue-500/20 rounded px-3 py-2 focus:ring-1 focus:ring-orange-500 focus:outline-hidden"
          />
        </div>

        {/* Status Ativo (em edição) */}
        {isEditing && (
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="activeCheckbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded accent-orange-500"
            />
            <label htmlFor="activeCheckbox" className="text-xs font-semibold text-slate-300 cursor-pointer">
              Material Ativo no Catálogo (desmarque para inativar lançamentos futuros)
            </label>
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-blue-500/15">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-[#070c14] hover:bg-blue-500/15 rounded border border-blue-500/20 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded shadow-[0_0_15px_-3px_rgba(249,115,22,0.4)] transition-all active:scale-95"
          >
            {isSubmitting ? "Salvando..." : isEditing ? "Salvar Alterações" : "Cadastrar Material"}
          </button>
        </div>
      </form>
    </div>
  );
}
