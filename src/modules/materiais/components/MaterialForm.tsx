"use client";

import React, { useState, useRef } from "react";
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

const PRESET_PACKAGE_TYPES = [
  "Galão",
  "Balde",
  "Lata",
  "Quarto (0,9 L)",
  "Tambor",
  "Outro",
];

const PRESET_PACKAGE_VOLUMES = [
  "3.6",
  "18",
  "0.9",
  "1",
  "5",
  "20",
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

  // Dados Técnicos de Consumo e Embalagem
  const [consumptionPerM2, setConsumptionPerM2] = useState(
    initialMaterial?.consumptionPerM2PerCoat !== undefined && initialMaterial?.consumptionPerM2PerCoat !== null
      ? String(initialMaterial.consumptionPerM2PerCoat)
      : ""
  );
  const [consumptionUnit, setConsumptionUnit] = useState(
    initialMaterial?.consumptionUnit || "L/m²/demão"
  );
  const [packageType, setPackageType] = useState(() => {
    if (!initialMaterial?.packageType) return "";
    return PRESET_PACKAGE_TYPES.includes(initialMaterial.packageType) ? initialMaterial.packageType : "Outro";
  });
  const [customPackageType, setCustomPackageType] = useState(() => {
    if (!initialMaterial?.packageType) return "";
    return PRESET_PACKAGE_TYPES.includes(initialMaterial.packageType) ? "" : initialMaterial.packageType;
  });
  const [packageVolume, setPackageVolume] = useState(() => {
    if (initialMaterial?.packageVolume === undefined || initialMaterial?.packageVolume === null) return "";
    const strVal = String(initialMaterial.packageVolume);
    return PRESET_PACKAGE_VOLUMES.includes(strVal) ? strVal : "Outro";
  });
  const [customPackageVolume, setCustomPackageVolume] = useState(() => {
    if (initialMaterial?.packageVolume === undefined || initialMaterial?.packageVolume === null) return "";
    const strVal = String(initialMaterial.packageVolume);
    return PRESET_PACKAGE_VOLUMES.includes(strVal) ? "" : strVal;
  });

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

  // Validação e Proteção contra Duplo Submit
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    setError(null);

    const finalName = name.trim();
    const finalCode = code.trim().toUpperCase();
    const finalType = type === "Outro" ? customType.trim() : type;
    const finalLocation = location === "Outro" ? customLocation.trim() : location;
    const finalPackageType = packageType === "Outro" ? customPackageType.trim() : packageType;
    const finalPackageVolume = packageVolume === "Outro" ? customPackageVolume.trim() : packageVolume;

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

    // Validação de consumo (se informado)
    let finalConsumption: number | null = null;
    if (consumptionPerM2.trim() !== "") {
      const parsedCons = Number(consumptionPerM2.replace(",", "."));
      if (isNaN(parsedCons) || parsedCons <= 0) {
        setError("O Consumo por m²/demão deve ser um número positivo maior que zero.");
        return;
      }
      finalConsumption = parsedCons;
    }

    // Validação de volume de embalagem (se informado)
    let parsedPkgVolume: number | null = null;
    if (finalPackageVolume.trim() !== "") {
      const parsedVol = Number(finalPackageVolume.replace(",", "."));
      if (isNaN(parsedVol) || parsedVol <= 0) {
        setError("O Volume da embalagem deve ser um número positivo maior que zero.");
        return;
      }
      parsedPkgVolume = parsedVol;
    }

    // Trava síncrona imediata contra cliques simultâneos
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await onSave({
        code: finalCode,
        name: finalName,
        type: finalType,
        manufacturer: manufacturer.trim() || null,
        color: color.trim() || null,
        unit,
        minimumStock: Number(minimumStock),
        location: finalLocation || null,
        technicalInfo: technicalInfo.trim() || null,
        consumptionPerM2PerCoat: finalConsumption,
        consumptionUnit: finalConsumption ? (consumptionUnit.trim() || "L/m²/demão") : null,
        packageType: finalPackageType ? finalPackageType.trim() : null,
        packageVolume: parsedPkgVolume,
        active,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar material.";
      setError(msg);
    } finally {
      isSubmittingRef.current = false;
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
      <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded text-xs text-slate-300">
        <p className="font-semibold text-blue-300">
          {isEditing ? "Edição de Dados Cadastrais:" : "Cadastro de Catálogo:"}
        </p>
        <p className="text-slate-400 text-[11px] mt-0.5">
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

        {/* Dados Técnicos de Consumo & Embalagem (Cálculo Automático de Pintura) */}
        <div className="bg-[#070c14] border border-blue-500/20 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-blue-500/15 pb-2">
            <div>
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                Cálculo de Consumo & Embalagem
              </span>
              <h3 className="text-xs font-bold text-white">
                Parâmetros Técnicos de Rendimento
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Opcional para não-tintas
            </span>
          </div>

          <p className="text-[11px] text-slate-400">
            Configure o consumo teórico por demão e a embalagem comercial para que as ordens de serviço calculem automaticamente a quantidade de litros e embalagens necessárias.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {/* Consumo por m² por demão */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Consumo por m²/demão
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={consumptionPerM2}
                onChange={(e) => setConsumptionPerM2(e.target.value)}
                placeholder="Ex: 0.20"
                className="w-full bg-[#0c1524] text-white border border-blue-500/20 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
              />
              <span className="text-[10px] text-slate-500 block mt-0.5">Ex: 0,20 L/m²/demão</span>
            </div>

            {/* Unidade de Consumo */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Unidade do Consumo
              </label>
              <input
                type="text"
                value={consumptionUnit}
                onChange={(e) => setConsumptionUnit(e.target.value)}
                placeholder="L/m²/demão"
                className="w-full bg-[#0c1524] text-white border border-blue-500/20 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
              />
              <span className="text-[10px] text-slate-500 block mt-0.5">Padrão: L/m²/demão</span>
            </div>

            {/* Tipo de Embalagem */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Tipo de Embalagem
              </label>
              <select
                value={packageType}
                onChange={(e) => setPackageType(e.target.value)}
                className="w-full bg-[#0c1524] text-white border border-blue-500/20 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              >
                <option value="">Não especificado</option>
                {PRESET_PACKAGE_TYPES.map((pkg) => (
                  <option key={pkg} value={pkg}>{pkg}</option>
                ))}
              </select>
              {packageType === "Outro" && (
                <input
                  type="text"
                  value={customPackageType}
                  onChange={(e) => setCustomPackageType(e.target.value)}
                  placeholder="Ex: Frasco, Tambor..."
                  className="w-full mt-1.5 bg-[#0c1524] text-white border border-blue-500/20 rounded px-2 py-1 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden text-xs"
                  required
                />
              )}
            </div>

            {/* Volume por Embalagem */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Volume por Embalagem (L)
              </label>
              <select
                value={packageVolume}
                onChange={(e) => setPackageVolume(e.target.value)}
                className="w-full bg-[#0c1524] text-white border border-blue-500/20 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
              >
                <option value="">Não especificado</option>
                {PRESET_PACKAGE_VOLUMES.map((vol) => (
                  <option key={vol} value={vol}>
                    {vol === "Outro" ? "Outro volume..." : `${vol} Litros`}
                  </option>
                ))}
              </select>
              {packageVolume === "Outro" && (
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={customPackageVolume}
                  onChange={(e) => setCustomPackageVolume(e.target.value)}
                  placeholder="Litros por embalagem"
                  className="w-full mt-1.5 bg-[#0c1524] text-white border border-blue-500/20 rounded px-2 py-1 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden text-xs font-mono"
                  required
                />
              )}
            </div>
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
            className="px-5 py-2 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-md shadow-[0_0_15px_-3px_rgba(249,115,22,0.4)] transition-all active:scale-95"
          >
            {isSubmitting ? "Salvando..." : isEditing ? "Salvar Alterações" : "Cadastrar Material"}
          </button>
        </div>
      </form>
    </div>
  );
}
