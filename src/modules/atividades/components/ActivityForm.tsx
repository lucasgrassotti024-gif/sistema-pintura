"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  ActivityPriority,
  ActivityPlannedMaterial,
  ActivityHistoryEntry,
} from "../types/activity.types";

interface ActivityFormProps {
  initialActivity?: Activity | null; // Quando fornecido, atua em modo de EDIÇÃO da atividade
  onSave: (activity: Activity) => void;
  onCancel: () => void;
}

const PRESET_AREAS = [
  "Área Industrial Norte",
  "Utilidades",
  "Geração de Vapor",
  "Logística",
  "Área de Tanques",
];

const PRESET_LOCALS = [
  "Pátio de Tanques",
  "Linha Principal de Incêndio",
  "Casa de Caldeiras",
  "Galpão 4",
  "Vias Internas",
  "Pipe Rack Principal",
];

const PRESET_EQUIPMENTS = [
  "Tanque T-01",
  "Tubulação 6 pol",
  "Caldeira B",
  "Vigas I e Pilares",
  "Piso Asfáltico / Concreto",
  "Estrutura de Suporte",
];

const PRESET_SERVICE_TYPES = [
  "Tratamento Manual/Mecânico (St 2 / St 3)",
  "Jateamento Abrasivo (Sa 2 ½)",
  "Pintura Epóxi",
  "Pintura Poliuretano (PU)",
  "Pintura Alta Temperatura (Silicone)",
  "Demarcação e Sinalização",
];

const PRESET_TEAMS = [
  "Equipe Alfa - Pintura Pesada",
  "Equipe Beta - Tubulações",
  "Equipe Geral",
  "Equipe de Manutenção Rápida",
];

export function ActivityForm({ initialActivity, onSave, onCancel }: ActivityFormProps) {
  const isEditing = Boolean(initialActivity);

  // Identificação
  const [orderNumber, setOrderNumber] = useState(initialActivity?.orderNumber || "");
  const [name, setName] = useState(initialActivity?.name || "");
  const [serviceType, setServiceType] = useState(initialActivity?.serviceType || PRESET_SERVICE_TYPES[0]);
  const [description, setDescription] = useState(initialActivity?.description || "");
  const [originReference, setOriginReference] = useState(initialActivity?.originReference || "");

  // Hierarquia Física
  const [selectedArea, setSelectedArea] = useState(() => {
    if (!initialActivity) return PRESET_AREAS[0];
    return PRESET_AREAS.includes(initialActivity.location.area) ? initialActivity.location.area : "Outro";
  });
  const [customArea, setCustomArea] = useState(() => {
    if (!initialActivity) return "";
    return PRESET_AREAS.includes(initialActivity.location.area) ? "" : initialActivity.location.area;
  });

  const [selectedLocal, setSelectedLocal] = useState(() => {
    if (!initialActivity) return PRESET_LOCALS[0];
    return PRESET_LOCALS.includes(initialActivity.location.local) ? initialActivity.location.local : "Outro";
  });
  const [customLocal, setCustomLocal] = useState(() => {
    if (!initialActivity) return "";
    return PRESET_LOCALS.includes(initialActivity.location.local) ? "" : initialActivity.location.local;
  });

  const [selectedEquipment, setSelectedEquipment] = useState(() => {
    if (!initialActivity) return PRESET_EQUIPMENTS[0];
    return PRESET_EQUIPMENTS.includes(initialActivity.location.equipment) ? initialActivity.location.equipment : "Outro";
  });
  const [customEquipment, setCustomEquipment] = useState(() => {
    if (!initialActivity) return "";
    return PRESET_EQUIPMENTS.includes(initialActivity.location.equipment) ? "" : initialActivity.location.equipment;
  });

  // Tags
  const [mainTag, setMainTag] = useState(initialActivity?.tags[0]?.code || "");
  const [additionalTags, setAdditionalTags] = useState<string[]>(
    initialActivity?.tags.slice(1).map((t) => t.code) || []
  );
  const [newAdditionalTag, setNewAdditionalTag] = useState("");

  // Programação e Responsabilidade
  const [plannedStartDate, setPlannedStartDate] = useState(initialActivity?.schedule.plannedStartDate || "");
  const [plannedEndDate, setPlannedEndDate] = useState(initialActivity?.schedule.plannedEndDate || "");
  const [priority, setPriority] = useState<ActivityPriority>(initialActivity?.priority || "media");
  const [assignedTo, setAssignedTo] = useState(initialActivity?.assignedTo || "");
  const [team, setTeam] = useState(initialActivity?.team || PRESET_TEAMS[0]);

  // Quantidade de Serviço
  const [serviceQuantity, setServiceQuantity] = useState(
    initialActivity?.serviceQuantity !== undefined ? String(initialActivity.serviceQuantity) : ""
  );
  const [serviceUnit, setServiceUnit] = useState(initialActivity?.serviceUnit || "m²");

  // Materiais Planejados
  const [plannedMaterials, setPlannedMaterials] = useState<ActivityPlannedMaterial[]>(
    initialActivity?.plannedMaterials || []
  );
  const [matName, setMatName] = useState("");
  const [matQty, setMatQty] = useState("");
  const [matUnit, setMatUnit] = useState("L");

  // Observações
  const [observations, setObservations] = useState(initialActivity?.observations || "");

  // Mensagens de Erro
  const [error, setError] = useState<string | null>(null);

  const handleAddAdditionalTag = () => {
    if (newAdditionalTag.trim()) {
      setAdditionalTags([...additionalTags, newAdditionalTag.trim()]);
      setNewAdditionalTag("");
    }
  };

  const handleRemoveAdditionalTag = (index: number) => {
    setAdditionalTags(additionalTags.filter((_, i) => i !== index));
  };

  const handleAddPlannedMaterial = () => {
    if (matName.trim() && parseFloat(matQty) > 0) {
      setPlannedMaterials([
        ...plannedMaterials,
        {
          id: `mat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          materialName: matName.trim(),
          quantity: parseFloat(matQty),
          unit: matUnit,
        },
      ]);
      setMatName("");
      setMatQty("");
    }
  };

  const handleRemovePlannedMaterial = (id: string) => {
    setPlannedMaterials(plannedMaterials.filter((m) => m.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validações obrigatórias
    if (!orderNumber.trim()) {
      setError("A Nota (Ordem de Serviço) é obrigatória.");
      return;
    }
    if (!name.trim()) {
      setError("O Nome da atividade é obrigatório.");
      return;
    }
    if (!plannedStartDate || !plannedEndDate) {
      setError("As datas planejadas de início e término são obrigatórias.");
      return;
    }
    if (plannedStartDate > plannedEndDate) {
      setError("A data de término não pode ser anterior à data de início.");
      return;
    }

    const finalArea = selectedArea === "Outro" ? customArea.trim() : selectedArea;
    const finalLocal = selectedLocal === "Outro" ? customLocal.trim() : selectedLocal;
    const finalEquipment = selectedEquipment === "Outro" ? customEquipment.trim() : selectedEquipment;

    if (!finalArea) {
      setError("Informe a Área da atividade.");
      return;
    }

    // Montagem das Tags
    const tagsList = [];
    if (mainTag.trim()) {
      tagsList.push({ id: `tag-${Date.now()}-main`, code: mainTag.trim().toUpperCase() });
    }
    additionalTags.forEach((tag, idx) => {
      tagsList.push({ id: `tag-${Date.now()}-${idx}`, code: tag.toUpperCase() });
    });

    const now = new Date().toISOString().replace("T", " ").substring(0, 16);
    const mockUser = "Coordenador de Pintura (Mock)";

    if (isEditing && initialActivity) {
      // MODO EDIÇÃO: Preserva progresso, consumos, ID e histórico anterior
      const changesList: string[] = [];
      if (initialActivity.name !== name.trim()) changesList.push(`Nome: '${initialActivity.name}' → '${name.trim()}'`);
      if (initialActivity.schedule.plannedStartDate !== plannedStartDate || initialActivity.schedule.plannedEndDate !== plannedEndDate) {
        changesList.push(
          `Datas: [${initialActivity.schedule.plannedStartDate} até ${initialActivity.schedule.plannedEndDate}] → [${plannedStartDate} até ${plannedEndDate}]`
        );
      }
      if (initialActivity.priority !== priority) changesList.push(`Prioridade: ${initialActivity.priority} → ${priority}`);
      if (initialActivity.assignedTo !== assignedTo.trim()) changesList.push(`Responsável: ${initialActivity.assignedTo || "-"} → ${assignedTo.trim() || "-"}`);
      if (initialActivity.team !== team) changesList.push(`Equipe: ${initialActivity.team || "-"} → ${team}`);
      if (initialActivity.location.area !== finalArea) changesList.push(`Área: ${initialActivity.location.area} → ${finalArea}`);

      const historyEntry: ActivityHistoryEntry = {
        id: `hist-edit-${Date.now()}`,
        timestamp: now,
        userId: "user-coord-1",
        userName: mockUser,
        action: "Edição e Atualização da Atividade",
        field: "Revisão Geral",
        oldValue: changesList.join(" | ") || "Dados revisados",
        newValue: "Dados atualizados",
        observation: observations.trim() || undefined,
      };

      const updatedActivity: Activity = {
        ...initialActivity,
        name: name.trim(),
        serviceType,
        tags: tagsList,
        location: {
          area: finalArea,
          local: finalLocal || "Geral",
          equipment: finalEquipment || "Não especificado",
        },
        description: description.trim() || name.trim(),
        priority,
        assignedTo: assignedTo.trim() || undefined,
        team,
        serviceQuantity: serviceQuantity ? parseFloat(serviceQuantity) : undefined,
        serviceUnit,
        plannedMaterials,
        originReference: originReference.trim() || undefined,
        observations: observations.trim() || undefined,
        schedule: {
          ...initialActivity.schedule,
          plannedStartDate,
          plannedEndDate,
          teamName: team,
        },
        history: [historyEntry, ...initialActivity.history],
        updatedAt: now.split(" ")[0],
      };

      onSave(updatedActivity);
    } else {
      // MODO CRIAÇÃO: Nova atividade
      const newActivity: Activity = {
        id: `act-${Date.now()}`,
        orderNumber: orderNumber.trim().toUpperCase(),
        name: name.trim(),
        serviceType,
        tags: tagsList,
        location: {
          area: finalArea,
          local: finalLocal || "Geral",
          equipment: finalEquipment || "Não especificado",
        },
        description: description.trim() || name.trim(),
        status: "programada",
        priority,
        assignedTo: assignedTo.trim() || undefined,
        team,
        serviceQuantity: serviceQuantity ? parseFloat(serviceQuantity) : undefined,
        serviceUnit,
        plannedMaterials,
        originReference: originReference.trim() || undefined,
        observations: observations.trim() || undefined,
        progressPercentage: 0,
        schedule: {
          plannedStartDate,
          plannedEndDate,
          teamName: team,
        },
        consumptions: [],
        history: [
          {
            id: `h-${Date.now()}`,
            timestamp: now,
            userId: "user-current",
            userName: assignedTo.trim() || "Operador",
            action: "Atividade cadastrada com status PROGRAMADA",
          },
        ],
        createdAt: now.split(" ")[0],
        updatedAt: now.split(" ")[0],
      };

      onSave(newActivity);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6 shadow-xs max-w-4xl mx-auto">
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {isEditing ? `Editar Atividade: ${initialActivity?.orderNumber}` : "Cadastrar Nova Atividade"}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEditing
              ? "Altere os dados operacionais ou datas da atividade. O identificador, progresso físico e consumos serão preservados."
              : "Preencha os dados operacionais. A atividade iniciará com status PROGRAMADA e 0% de progresso."}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 bg-slate-100 rounded border border-slate-200"
        >
          Cancelar
        </button>
      </div>

      {error && (
        <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-md font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bloco 1: Identificação Básica */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">
            1. Identificação da Atividade
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nota (Ordem de Serviço) *
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Ex.: OS-2026-104"
                disabled={isEditing} // Regra: Nota é imutável em edição para preservar a identidade da OS
                className={`w-full text-sm border border-slate-300 rounded px-3 py-1.5 uppercase font-mono focus:ring-1 focus:ring-blue-500 focus:outline-hidden ${
                  isEditing ? "bg-slate-100 text-slate-600 cursor-not-allowed" : ""
                }`}
                required
              />
              {isEditing && (
                <span className="text-[10px] text-slate-400 mt-0.5 block">Identificador fixo da atividade</span>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nome da Atividade *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Aplicação de Fundo Epóxi na Tubulação da Linha B"
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tipo de Serviço
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              >
                {PRESET_SERVICE_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Origem / Referência
              </label>
              <input
                type="text"
                value={originReference}
                onChange={(e) => setOriginReference(e.target.value)}
                placeholder="Ex.: Relatório de Inspeção R-44 / Chamado #982"
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Descrição Detalhada do Serviço
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Especificações, procedimentos ou detalhes complementares da intervenção..."
              className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Bloco 2: Localização Física com Opção 'Outro' */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">
            2. Localização Física
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Área */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Área *
              </label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              >
                {PRESET_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
                <option value="Outro">Outro (Especificar)</option>
              </select>
              {selectedArea === "Outro" && (
                <input
                  type="text"
                  value={customArea}
                  onChange={(e) => setCustomArea(e.target.value)}
                  placeholder="Especifique a Área..."
                  className="mt-1.5 w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              )}
            </div>

            {/* Local */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Local
              </label>
              <select
                value={selectedLocal}
                onChange={(e) => setSelectedLocal(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              >
                {PRESET_LOCALS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
                <option value="Outro">Outro (Especificar)</option>
              </select>
              {selectedLocal === "Outro" && (
                <input
                  type="text"
                  value={customLocal}
                  onChange={(e) => setCustomLocal(e.target.value)}
                  placeholder="Especifique o Local..."
                  className="mt-1.5 w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              )}
            </div>

            {/* Equipamento / Estrutura */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Equipamento / Estrutura
              </label>
              <select
                value={selectedEquipment}
                onChange={(e) => setSelectedEquipment(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              >
                {PRESET_EQUIPMENTS.map((eq) => (
                  <option key={eq} value={eq}>
                    {eq}
                  </option>
                ))}
                <option value="Outro">Outro (Especificar)</option>
              </select>
              {selectedEquipment === "Outro" && (
                <input
                  type="text"
                  value={customEquipment}
                  onChange={(e) => setCustomEquipment(e.target.value)}
                  placeholder="Especifique o Equipamento..."
                  className="mt-1.5 w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              )}
            </div>
          </div>
        </div>

        {/* Bloco 3: Tags (Principal e Adicionais) */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">
            3. Identificadores de Campo (Tags)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tag Principal
              </label>
              <input
                type="text"
                value={mainTag}
                onChange={(e) => setMainTag(e.target.value)}
                placeholder="Ex.: TK-102 / VLV-401"
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 uppercase font-mono focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tags Adicionais (Opcionais)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAdditionalTag}
                  onChange={(e) => setNewAdditionalTag(e.target.value)}
                  placeholder="Adicionar tag..."
                  className="flex-1 text-sm border border-slate-300 rounded px-3 py-1.5 uppercase font-mono focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddAdditionalTag}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-700"
                >
                  + Adicionar
                </button>
              </div>
              {additionalTags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {additionalTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 text-xs font-mono bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-slate-800"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveAdditionalTag(idx)}
                        className="text-slate-400 hover:text-red-600 font-bold ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bloco 4: Programação, Responsabilidade e Prioridade */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">
            4. Programação e Responsabilidade
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Data Inicial Planejada *
              </label>
              <input
                type="date"
                value={plannedStartDate}
                onChange={(e) => setPlannedStartDate(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Data Término Planejada *
              </label>
              <input
                type="date"
                value={plannedEndDate}
                onChange={(e) => setPlannedEndDate(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Prioridade
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ActivityPriority)}
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Responsável
              </label>
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="Ex.: Carlos Andrade"
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Equipe Alocada
              </label>
              <select
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              >
                {PRESET_TEAMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Qtd. Estimada do Serviço
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={serviceQuantity}
                onChange={(e) => setServiceQuantity(e.target.value)}
                placeholder="Ex.: 120"
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Unidade do Serviço
              </label>
              <select
                value={serviceUnit}
                onChange={(e) => setServiceUnit(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="m²">m² (Metros quadrados)</option>
                <option value="m">m (Metros lineares)</option>
                <option value="un">un (Unidades)</option>
                <option value="kg">kg</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bloco 5: Materiais Planejados */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">
            5. Materiais Planejados (Insumos Estimados)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
            <div className="sm:col-span-6">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nome do Material
              </label>
              <input
                type="text"
                value={matName}
                onChange={(e) => setMatName(e.target.value)}
                placeholder="Ex.: Primer Epóxi Poliamida"
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Qtd. Estimada
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={matQty}
                onChange={(e) => setMatQty(e.target.value)}
                placeholder="Ex.: 18"
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Unidade
              </label>
              <select
                value={matUnit}
                onChange={(e) => setMatUnit(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded px-2 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="L">L (Litros)</option>
                <option value="kg">kg</option>
                <option value="gl">Galão</option>
                <option value="un">Unidade</option>
              </select>
            </div>
            <div className="sm:col-span-1">
              <button
                type="button"
                onClick={handleAddPlannedMaterial}
                className="w-full py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-700"
              >
                +
              </button>
            </div>
          </div>

          {plannedMaterials.length > 0 && (
            <div className="border border-slate-200 rounded divide-y text-xs bg-slate-50">
              {plannedMaterials.map((m) => (
                <div key={m.id} className="p-2 flex justify-between items-center">
                  <span className="font-medium text-slate-800">{m.materialName}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-600 font-mono">
                      {m.quantity} {m.unit}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemovePlannedMaterial(m.id)}
                      className="text-slate-400 hover:text-red-600 font-bold"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bloco 6: Observações */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-700">
            Observações Operacionais
          </label>
          <textarea
            rows={2}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Requisitos de andaime, restrições de clima, EPIs específicos ou observações gerais..."
            className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

        {/* Ações do Formulário */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded border border-slate-300"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs transition-colors"
          >
            {isEditing ? "Salvar Alterações" : "Cadastrar Atividade"}
          </button>
        </div>
      </form>
    </div>
  );
}
