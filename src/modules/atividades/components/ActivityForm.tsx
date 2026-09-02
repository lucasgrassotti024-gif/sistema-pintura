"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  ActivityPriority,
  ActivityPlannedMaterial,
  ActivityHistoryEntry,
} from "../types/activity.types";
import { Material } from "@/modules/materiais/types/material.types";
import { getMaterials } from "@/modules/materiais/services/material.service";

interface ActivityFormProps {
  initialActivity?: Activity | null; // Quando fornecido, atua em modo de EDIÇÃO da atividade
  onSave: (activity: Activity) => Promise<void> | void;
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
  const [catalogMaterials, setCatalogMaterials] = useState<Material[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [plannedMaterials, setPlannedMaterials] = useState<ActivityPlannedMaterial[]>(
    initialActivity?.plannedMaterials || []
  );
  const [selectedCatalogMaterial, setSelectedCatalogMaterial] = useState<Material | null>(null);
  const [materialSearch, setMaterialSearch] = useState("");
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [matQty, setMatQty] = useState("");
  const [matUnit, setMatUnit] = useState("L");
  const [editingPlannedId, setEditingPlannedId] = useState<string | null>(null);

  // Carregar catálogo de materiais para seleção rápida
  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      setLoadingCatalog(true);
      try {
        const data = await getMaterials();
        if (isMounted) {
          setCatalogMaterials(data.filter((m) => m.active));
        }
      } catch (err) {
        console.error("Erro ao carregar catálogo de materiais para o formulário:", err);
      } finally {
        if (isMounted) setLoadingCatalog(false);
      }
    }
    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtragem dinâmica do catálogo para autocomplete
  const filteredCatalog = catalogMaterials.filter((m) => {
    if (!materialSearch.trim()) return true;
    const term = materialSearch.toLowerCase();
    return (
      m.name.toLowerCase().includes(term) ||
      m.code.toLowerCase().includes(term) ||
      m.type.toLowerCase().includes(term)
    );
  });

  // Observações
  const [observations, setObservations] = useState(initialActivity?.observations || "");

  // Mensagens de Erro e Estado de Submissão
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const handleAddAdditionalTag = () => {
    if (newAdditionalTag.trim()) {
      setAdditionalTags([...additionalTags, newAdditionalTag.trim()]);
      setNewAdditionalTag("");
    }
  };

  const handleRemoveAdditionalTag = (index: number) => {
    setAdditionalTags(additionalTags.filter((_, i) => i !== index));
  };

  const handleSelectMaterial = (mat: Material) => {
    setSelectedCatalogMaterial(mat);
    setMaterialSearch(`${mat.code} - ${mat.name}`);
    setMatUnit(mat.unit || "L");
    setIsSearchDropdownOpen(false);
    setError(null);
  };

  const handleAddPlannedMaterial = () => {
    if (!selectedCatalogMaterial) {
      setError("Selecione um material válido do catálogo.");
      return;
    }

    const qtyNum = parseFloat(matQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError("Informe uma quantidade válida maior que 0.");
      return;
    }

    // Se estiver editando um item existente da lista
    if (editingPlannedId) {
      setPlannedMaterials((prev) =>
        prev.map((item) =>
          item.id === editingPlannedId
            ? {
                ...item,
                materialId: selectedCatalogMaterial.id,
                materialCode: selectedCatalogMaterial.code,
                materialName: selectedCatalogMaterial.name,
                quantity: qtyNum,
                unit: matUnit,
              }
            : item
        )
      );
      setEditingPlannedId(null);
      setSelectedCatalogMaterial(null);
      setMaterialSearch("");
      setMatQty("");
      setError(null);
      return;
    }

    // Validação contra duplicação de material na mesma atividade
    const isDuplicate = plannedMaterials.some(
      (m) =>
        m.materialId === selectedCatalogMaterial.id ||
        m.materialName.trim().toLowerCase() === selectedCatalogMaterial.name.trim().toLowerCase()
    );

    if (isDuplicate) {
      setError(
        `O material "${selectedCatalogMaterial.name}" já está na lista. Edite a quantidade existente ou remova-o antes de adicionar novamente.`
      );
      return;
    }

    setPlannedMaterials([
      ...plannedMaterials,
      {
        id: `mat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        materialId: selectedCatalogMaterial.id,
        materialCode: selectedCatalogMaterial.code,
        materialName: selectedCatalogMaterial.name,
        quantity: qtyNum,
        unit: matUnit,
      },
    ]);

    setSelectedCatalogMaterial(null);
    setMaterialSearch("");
    setMatQty("");
    setError(null);
  };

  const handleStartEditPlannedMaterial = (item: ActivityPlannedMaterial) => {
    setEditingPlannedId(item.id);
    const foundMat = catalogMaterials.find(
      (m) => m.id === item.materialId || m.name.toLowerCase() === item.materialName.toLowerCase()
    );
    if (foundMat) {
      setSelectedCatalogMaterial(foundMat);
      setMaterialSearch(`${foundMat.code} - ${foundMat.name}`);
    } else {
      setMaterialSearch(item.materialName);
    }
    setMatQty(String(item.quantity));
    setMatUnit(item.unit);
  };

  const handleCancelEditPlanned = () => {
    setEditingPlannedId(null);
    setSelectedCatalogMaterial(null);
    setMaterialSearch("");
    setMatQty("");
  };

  const handleRemovePlannedMaterial = (id: string) => {
    setPlannedMaterials(plannedMaterials.filter((m) => m.id !== id));
    if (editingPlannedId === id) {
      handleCancelEditPlanned();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
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

    // Trava síncrona imediata contra cliques simultâneos
    isSubmittingRef.current = true;
    setIsSubmitting(true);

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

      try {
        await onSave(updatedActivity);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao salvar atividade no sistema.";
        setError(msg);
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
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

      try {
        await onSave(newActivity);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao cadastrar atividade no sistema.";
        setError(msg);
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6 shadow-sm max-w-4xl mx-auto">
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
          className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors"
        >
          Cancelar
        </button>
      </div>

      {error && (
        <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-md font-medium font-mono">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bloco 1: Identificação Básica */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-blue-700 border-b border-slate-200 pb-1">
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

        {/* Bloco 5: Materiais Planejados (Seleção via Catálogo) */}
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b pb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              5. Materiais Planejados (Insumos do Catálogo)
            </h3>
            {loadingCatalog && (
              <span className="text-[11px] text-slate-400 font-mono">Carregando catálogo...</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
            {/* Campo de Pesquisa / Autocomplete */}
            <div className="sm:col-span-6 relative">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Pesquisar Material no Catálogo
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={materialSearch}
                  onChange={(e) => {
                    setMaterialSearch(e.target.value);
                    setIsSearchDropdownOpen(true);
                    if (selectedCatalogMaterial && e.target.value !== `${selectedCatalogMaterial.code} - ${selectedCatalogMaterial.name}`) {
                      setSelectedCatalogMaterial(null);
                    }
                  }}
                  onFocus={() => setIsSearchDropdownOpen(true)}
                  className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
                {selectedCatalogMaterial && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCatalogMaterial(null);
                      setMaterialSearch("");
                    }}
                    className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Dropdown de Autocomplete */}
              {isSearchDropdownOpen && filteredCatalog.length > 0 && !selectedCatalogMaterial && (
                <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-300 rounded-md shadow-lg divide-y text-xs">
                  {filteredCatalog.map((mat) => (
                    <button
                      key={mat.id}
                      type="button"
                      onClick={() => handleSelectMaterial(mat)}
                      className="w-full text-left p-2 hover:bg-slate-50 flex justify-between items-center transition-colors"
                    >
                      <div>
                        <span className="font-mono font-bold text-blue-600 mr-2">{mat.code}</span>
                        <span className="text-slate-800 font-medium">{mat.name}</span>
                        <span className="text-slate-400 text-[10px] block">{mat.type}</span>
                      </div>
                      <span className="text-slate-500 font-mono text-[11px] px-1.5 py-0.5 bg-slate-100 rounded">
                        Estoque: {mat.currentStock} {mat.unit}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quantidade Estimada */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Qtd. Estimada
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={matQty}
                onChange={(e) => setMatQty(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Unidade (Automática do Material ou ajustável) */}
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

            {/* Botão de Adicionar / Salvar Edição */}
            <div className="sm:col-span-1 flex gap-1">
              <button
                type="button"
                onClick={handleAddPlannedMaterial}
                title={editingPlannedId ? "Atualizar item" : "Adicionar material"}
                className={`w-full py-1.5 text-xs font-bold rounded text-white transition-colors ${
                  editingPlannedId
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {editingPlannedId ? "✓" : "+"}
              </button>
              {editingPlannedId && (
                <button
                  type="button"
                  onClick={handleCancelEditPlanned}
                  title="Cancelar edição"
                  className="py-1.5 px-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 rounded text-slate-700"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Lista de Materiais Adicionados */}
          {plannedMaterials.length > 0 ? (
            <div className="border border-slate-200 rounded divide-y text-xs bg-slate-50">
              {plannedMaterials.map((m) => (
                <div key={m.id} className="p-2.5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {m.materialCode && (
                      <span className="font-mono text-[11px] font-bold text-blue-600 px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded">
                        {m.materialCode}
                      </span>
                    )}
                    <span className="font-medium text-slate-800">{m.materialName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-700 font-mono font-semibold">
                      {m.quantity} {m.unit}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStartEditPlannedMaterial(m)}
                      title="Editar quantidade"
                      className="text-blue-600 hover:text-blue-800 font-medium text-xs underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemovePlannedMaterial(m.id)}
                      title="Remover material"
                      className="text-slate-400 hover:text-red-600 font-bold text-sm leading-none"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Nenhum material planejado adicionado a esta atividade.
            </p>
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
            className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

        {/* Ações do Formulário */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-md shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95"
          >
            {isSubmitting && (
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {isSubmitting
              ? "Salvando..."
              : isEditing
              ? "Salvar Alterações"
              : "Cadastrar Atividade"}
          </button>
        </div>
      </form>
    </div>
  );
}
