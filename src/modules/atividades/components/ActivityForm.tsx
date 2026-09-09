"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  ActivityPriority,
  ActivityPlannedMaterial,
  ActivityHistoryEntry,
  ActivityPhotoItem,
} from "../types/activity.types";
import { Material } from "@/modules/materiais/types/material.types";
import { getMaterials } from "@/modules/materiais/services/material.service";
import {
  getAssignableUsers,
  AssignableUser,
  uploadActivityPhotos,
  deleteActivityPhotos,
  getActivityPhotos,
} from "../services/activity.service";

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
  const [assignedUserId, setAssignedUserId] = useState<string>(initialActivity?.assignedUserId || "");
  const [assignedTo, setAssignedTo] = useState(initialActivity?.assignedTo || "");
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const [team, setTeam] = useState(initialActivity?.team || PRESET_TEAMS[0]);

  // Quantidade de Serviço
  const [serviceQuantity, setServiceQuantity] = useState(
    initialActivity?.serviceQuantity !== undefined ? String(initialActivity.serviceQuantity) : ""
  );
  const [serviceUnit, setServiceUnit] = useState(initialActivity?.serviceUnit || "m²");

  // Materiais Planejados
  const [catalogMaterials, setCatalogMaterials] = useState<Material[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [plannedMaterials, setPlannedMaterials] = useState<ActivityPlannedMaterial[]>(() => {
    if (!initialActivity?.plannedMaterials) return [];
    // Desduplicação defensiva profilática contra dados corrompidos preexistentes no banco
    const seenKeys = new Set<string>();
    const sanitized: ActivityPlannedMaterial[] = [];
    for (const pm of initialActivity.plannedMaterials) {
      const key = pm.materialId ? `id:${pm.materialId}` : `name:${pm.materialName.trim().toLowerCase()}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        sanitized.push(pm);
      }
    }
    return sanitized;
  });
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

  // Carregar responsáveis ativos cadastrados no sistema
  useEffect(() => {
    let isMounted = true;
    async function loadUsers() {
      setLoadingUsers(true);
      try {
        const users = await getAssignableUsers();
        if (!isMounted) return;
        setAssignableUsers(users);

        // Se houver initialActivity com assignedUserId mas sem assignedTo, resolve o nome
        if (initialActivity?.assignedUserId && !initialActivity?.assignedTo) {
          const matched = users.find((u) => u.id === initialActivity.assignedUserId);
          if (matched) setAssignedTo(matched.fullName);
        } else if (initialActivity?.assignedTo && !initialActivity?.assignedUserId) {
          // Compatibilidade com atividades legadas: se o nome coincidir, vincula o UUID
          const matched = users.find(
            (u) => u.fullName.trim().toLowerCase() === initialActivity.assignedTo?.trim().toLowerCase()
          );
          if (matched) setAssignedUserId(matched.id);
        }
      } catch (err) {
        console.error("Erro ao carregar lista de responsáveis:", err);
      } finally {
        if (isMounted) setLoadingUsers(false);
      }
    }
    loadUsers();
    return () => {
      isMounted = false;
    };
  }, [initialActivity]);

  // Fechar dropdown de responsáveis ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    }
    if (isUserDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserDropdownOpen]);

  // Filtragem dinâmica de usuários para seleção
  const filteredUsers = assignableUsers.filter((u) => {
    if (!userSearchTerm.trim()) return true;
    return u.fullName.toLowerCase().includes(userSearchTerm.toLowerCase());
  });

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

  // Fotos da Atividade
  const [existingPhotos, setExistingPhotos] = useState<ActivityPhotoItem[]>(initialActivity?.photos || []);
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<{ id: string; file: File; previewUrl: string }[]>([]);
  const [photoIdsToDelete, setPhotoIdsToDelete] = useState<string[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // Carregar fotos existentes caso não venham em initialActivity
  useEffect(() => {
    let isMounted = true;
    if (initialActivity?.id) {
      if (initialActivity.photos && initialActivity.photos.length > 0) {
        setExistingPhotos(initialActivity.photos);
      } else {
        setLoadingPhotos(true);
        getActivityPhotos(initialActivity.id, true)
          .then((pts) => {
            if (isMounted) setExistingPhotos(pts);
          })
          .catch((err) => console.warn("Erro ao buscar fotos da atividade:", err))
          .finally(() => {
            if (isMounted) setLoadingPhotos(false);
          });
      }
    }
    return () => {
      isMounted = false;
    };
  }, [initialActivity]);

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

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);

    const totalCurrent = (existingPhotos.length - photoIdsToDelete.length) + newPhotoFiles.length;
    if (totalCurrent + selectedFiles.length > 8) {
      setError("Limite máximo de 8 fotos por atividade excedido.");
      return;
    }

    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    for (const f of selectedFiles) {
      if (f.size > 5242880) {
        setError(`A foto "${f.name}" excede o tamanho máximo de 5 MB.`);
        return;
      }
      if (!allowedMimes.includes(f.type)) {
        setError(`Formato do arquivo "${f.name}" inválido. Permitido: JPG, PNG, WEBP.`);
        return;
      }
    }

    const newPreviews = selectedFiles.map((file) => ({
      id: `preview-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setNewPhotoFiles((prev) => [...prev, ...selectedFiles]);
    setNewPhotoPreviews((prev) => [...prev, ...newPreviews]);
    setError(null);
  };

  const handleRemoveNewPhoto = (index: number) => {
    const previewToRemove = newPhotoPreviews[index];
    if (previewToRemove?.previewUrl) {
      URL.revokeObjectURL(previewToRemove.previewUrl);
    }
    setNewPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setNewPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleToggleDeleteExistingPhoto = (photoId: string) => {
    setPhotoIdsToDelete((prev) =>
      prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]
    );
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
    const mockUser = "Coordenador de Pintura";

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
        assignedUserId: assignedUserId || undefined,
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
        // 1. Salvar os dados cadastrais da atividade
        await onSave(updatedActivity);

        // 2. Se houver fotos marcadas para exclusão, remover com segurança e auditoria
        if (photoIdsToDelete.length > 0) {
          try {
            await deleteActivityPhotos(initialActivity.id, photoIdsToDelete);
          } catch (delErr) {
            console.warn("Aviso ao excluir fotos marcadas:", delErr);
          }
        }

        // 3. Se houver novas fotos anexadas, realizar upload atômico
        if (newPhotoFiles.length > 0) {
          await uploadActivityPhotos(
            initialActivity.id,
            newPhotoFiles,
            `Fotos adicionadas na edição da OS ${updatedActivity.orderNumber}`
          );
        }
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
        assignedUserId: assignedUserId || undefined,
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
        // 1. Criar a atividade no Supabase e aguardar resolução
        await onSave(newActivity);

        // Se houver novas fotos anexadas, obter o ID da atividade cadastrada
        if (newPhotoFiles.length > 0) {
          // Busca a atividade recém-criada pelo número de OS
          const { fetchActivities } = await import("../services/activity.service");
          const allActs = await fetchActivities();
          const createdAct = allActs.find((a) => a.orderNumber === newActivity.orderNumber);

          if (createdAct?.id) {
            await uploadActivityPhotos(
              createdAct.id,
              newPhotoFiles,
              `Fotos iniciais anexadas no cadastro da OS ${newActivity.orderNumber}`
            );
          }
        }
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
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6 space-y-6 shadow-sm max-w-4xl mx-auto transition-colors duration-200">
      <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {isEditing ? `Editar Atividade: ${initialActivity?.orderNumber}` : "Cadastrar Nova Atividade"}
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {isEditing
              ? "Altere os dados operacionais ou datas da atividade. O identificador, progresso físico e consumos serão preservados."
              : "Preencha os dados operacionais. A atividade iniciará com status PROGRAMADA e 0% de progresso."}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-3 py-1.5 bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-highlight)] rounded border border-[var(--border-subtle)] transition-colors cursor-pointer"
        >
          Cancelar
        </button>
      </div>

      {error && (
        <div className="p-3 text-xs bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-md font-medium font-mono">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bloco 1: Identificação Básica */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 border-b border-[var(--border-subtle)] pb-1">
            1. Identificação da Atividade
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Nota (Ordem de Serviço) *
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                disabled={isEditing} // Regra: Nota é imutável em edição para preservar a identidade da OS
                className={`w-full text-sm border border-[var(--border-medium)] rounded px-3 py-1.5 uppercase font-mono focus:ring-1 focus:ring-blue-500 focus:outline-hidden ${
                  isEditing ? "opacity-60 bg-[var(--bg-surface-raised)] cursor-not-allowed" : ""
                }`}
                required
              />
              {isEditing && (
                <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">Identificador fixo da atividade</span>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Nome da Atividade *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-sm border border-[var(--border-medium)] rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Tipo de Serviço
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full text-sm border border-[var(--border-medium)] rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              >
                {PRESET_SERVICE_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Origem / Referência
              </label>
              <input
                type="text"
                value={originReference}
                onChange={(e) => setOriginReference(e.target.value)}
                className="w-full text-sm border border-[var(--border-medium)] rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Descrição Detalhada do Serviço
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm border border-[var(--border-medium)] rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Bloco 2: Localização Física com Opção 'Outro' */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 border-b border-[var(--border-subtle)] pb-1">
            2. Localização Física
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Área */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Área *
              </label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full text-sm border border-[var(--border-medium)] rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
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
                  className="mt-1.5 w-full text-xs border border-[var(--border-medium)] rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              )}
            </div>

            {/* Local */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Local
              </label>
              <select
                value={selectedLocal}
                onChange={(e) => setSelectedLocal(e.target.value)}
                className="w-full text-sm border border-[var(--border-medium)] rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
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
                  className="mt-1.5 w-full text-xs border border-[var(--border-medium)] rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              )}
            </div>

            {/* Equipamento / Estrutura */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Equipamento / Estrutura
              </label>
              <select
                value={selectedEquipment}
                onChange={(e) => setSelectedEquipment(e.target.value)}
                className="w-full text-sm border border-[var(--border-medium)] rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
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
                  className="mt-1.5 w-full text-xs border border-[var(--border-medium)] rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              )}
            </div>
          </div>
        </div>

        {/* Bloco 3: Tags (Principal e Adicionais) */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 border-b border-[var(--border-subtle)] pb-1">
            3. Identificadores de Campo (Tags)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Tag Principal
              </label>
              <input
                type="text"
                value={mainTag}
                onChange={(e) => setMainTag(e.target.value)}
                className="w-full text-sm border border-[var(--border-medium)] rounded px-3 py-1.5 uppercase font-mono focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Tags Adicionais (Opcionais)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAdditionalTag}
                  onChange={(e) => setNewAdditionalTag(e.target.value)}
                  className="flex-1 text-sm border border-[var(--border-medium)] rounded px-3 py-1.5 uppercase font-mono focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddAdditionalTag}
                  className="px-3 py-1.5 text-xs font-semibold bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-highlight)] border border-[var(--border-medium)] rounded text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  + Adicionar
                </button>
              </div>
              {additionalTags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {additionalTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 text-xs font-mono bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] px-2 py-0.5 rounded text-[var(--text-primary)]"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveAdditionalTag(idx)}
                        className="text-[var(--text-muted)] hover:text-rose-500 font-bold ml-1 cursor-pointer"
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
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 border-b border-[var(--border-subtle)] pb-1">
            4. Programação e Responsabilidade
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Data Inicial Planejada *
              </label>
              <input
                type="date"
                value={plannedStartDate}
                onChange={(e) => setPlannedStartDate(e.target.value)}
                className="w-full text-sm border border-[var(--border-medium)] rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Data Término Planejada *
              </label>
              <input
                type="date"
                value={plannedEndDate}
                onChange={(e) => setPlannedEndDate(e.target.value)}
                className="w-full text-sm border border-[var(--border-medium)] rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Prioridade
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ActivityPriority)}
                className="w-full text-sm border border-[var(--border-medium)] rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>

            <div className="relative" ref={userDropdownRef}>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Responsável
              </label>
              
              {/* Botão Gatilho do Seletor */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserDropdownOpen((prev) => !prev);
                    setUserSearchTerm("");
                  }}
                  className="w-full text-left text-sm border border-[var(--border-medium)] rounded px-3 py-1.5 bg-[var(--bg-surface)] hover:border-slate-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className={assignedTo ? "text-[var(--text-primary)] font-medium truncate" : "text-[var(--text-muted)] truncate"}>
                    {assignedTo || "Selecione um responsável..."}
                  </span>
                  
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {assignedUserId && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssignedUserId("");
                          setAssignedTo("");
                        }}
                        title="Remover responsável"
                        className="text-xs text-[var(--text-muted)] hover:text-rose-400 p-0.5 rounded cursor-pointer transition-colors"
                      >
                        ×
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--text-muted)]">▼</span>
                  </div>
                </button>

                {/* Dropdown Flutuante Pesquisável */}
                {isUserDropdownOpen && (
                  <div className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-medium)] rounded-md shadow-xl flex flex-col">
                    {/* Campo de Pesquisa Interna */}
                    <div className="p-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-raised)]">
                      <div className="relative">
                        <input
                          type="text"
                          autoFocus
                          placeholder="🔍 Pesquisar responsável..."
                          value={userSearchTerm}
                          onChange={(e) => setUserSearchTerm(e.target.value)}
                          className="w-full text-xs border border-[var(--border-medium)] rounded px-2.5 py-1.5 bg-[var(--bg-surface)] text-[var(--text-primary)] focus:ring-1 focus:ring-blue-500 focus:outline-hidden placeholder:text-[var(--text-muted)]"
                        />
                      </div>
                    </div>

                    {/* Lista de Opções */}
                    <div className="overflow-y-auto max-h-48 divide-y divide-[var(--border-subtle)] text-xs">
                      {/* Opção Desatribuir */}
                      <button
                        type="button"
                        onClick={() => {
                          setAssignedUserId("");
                          setAssignedTo("");
                          setIsUserDropdownOpen(false);
                          setUserSearchTerm("");
                        }}
                        className={`w-full text-left p-2.5 hover:bg-[var(--bg-surface-raised)] flex items-center justify-between transition-colors cursor-pointer ${
                          !assignedUserId ? "bg-blue-500/10 text-blue-400 font-medium" : "text-[var(--text-muted)]"
                        }`}
                      >
                        <span>— Não atribuído (vazio)</span>
                        {!assignedUserId && <span className="text-blue-400 font-bold">✓</span>}
                      </button>

                      {loadingUsers ? (
                        <div className="p-3 text-center text-xs text-[var(--text-muted)]">
                          Carregando responsáveis...
                        </div>
                      ) : filteredUsers.length === 0 ? (
                        <div className="p-3 text-center text-xs text-[var(--text-muted)]">
                          {assignableUsers.length === 0
                            ? "Nenhum responsável disponível no sistema."
                            : "Nenhum responsável encontrado para a pesquisa."}
                        </div>
                      ) : (
                        filteredUsers.map((user) => {
                          const isSelected = assignedUserId === user.id;
                          return (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => {
                                setAssignedUserId(user.id);
                                setAssignedTo(user.fullName);
                                setIsUserDropdownOpen(false);
                                setUserSearchTerm("");
                              }}
                              className={`w-full text-left p-2.5 hover:bg-[var(--bg-surface-raised)] flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected ? "bg-emerald-500/10 text-emerald-400 font-semibold" : "text-[var(--text-primary)]"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-slate-700/60 border border-slate-600/40 text-[10px] flex items-center justify-center font-bold text-slate-300">
                                  {user.fullName.charAt(0).toUpperCase()}
                                </span>
                                <span>{user.fullName}</span>
                              </div>
                              {isSelected && <span className="text-emerald-400 font-bold">✓</span>}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Equipe Alocada
              </label>
              <select
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="w-full text-sm border border-[var(--border-medium)] rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              >
                {PRESET_TEAMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Qtd. Estimada do Serviço
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={serviceQuantity}
                onChange={(e) => setServiceQuantity(e.target.value)}
                className="w-full text-sm border border-[var(--border-medium)] rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Unidade do Serviço
              </label>
              <select
                value={serviceUnit}
                onChange={(e) => setServiceUnit(e.target.value)}
                className="w-full text-sm border border-[var(--border-medium)] rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
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
          <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-1">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              5. Materiais Planejados (Insumos do Catálogo)
            </h3>
            {loadingCatalog && (
              <span className="text-[11px] text-[var(--text-muted)] font-mono">Carregando catálogo...</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
            {/* Campo de Pesquisa / Autocomplete */}
            <div className="sm:col-span-6 relative">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
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
                  className="w-full text-sm border border-[var(--border-medium)] rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
                {selectedCatalogMaterial && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCatalogMaterial(null);
                      setMaterialSearch("");
                    }}
                    className="absolute right-2.5 top-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Dropdown de Autocomplete */}
              {isSearchDropdownOpen && filteredCatalog.length > 0 && !selectedCatalogMaterial && (
                <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[var(--bg-surface)] border border-[var(--border-medium)] rounded-md shadow-lg divide-y divide-[var(--border-subtle)] text-xs">
                  {filteredCatalog.map((mat) => (
                    <button
                      key={mat.id}
                      type="button"
                      onClick={() => handleSelectMaterial(mat)}
                      className="w-full text-left p-2.5 hover:bg-[var(--bg-surface-raised)] flex justify-between items-center transition-colors cursor-pointer"
                    >
                      <div>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 mr-2">{mat.code}</span>
                        <span className="text-[var(--text-primary)] font-medium">{mat.name}</span>
                        <span className="text-[var(--text-muted)] text-[10px] block">{mat.type}</span>
                      </div>
                      <span className="text-[var(--text-secondary)] font-mono text-[11px] px-1.5 py-0.5 bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] rounded">
                        Estoque: {mat.currentStock} {mat.unit}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quantidade Estimada */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Qtd. Estimada
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={matQty}
                onChange={(e) => setMatQty(e.target.value)}
                className="w-full text-sm border border-[var(--border-medium)] rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Unidade */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Unidade
              </label>
              <select
                value={matUnit}
                onChange={(e) => setMatUnit(e.target.value)}
                className="w-full text-sm border border-[var(--border-medium)] rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
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
                className={`w-full py-1.5 text-xs font-bold rounded text-white transition-colors cursor-pointer ${
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
                  className="py-1.5 px-2 text-xs font-bold bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-highlight)] rounded text-[var(--text-secondary)] border border-[var(--border-subtle)] cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Lista de Materiais Adicionados */}
          {plannedMaterials.length > 0 ? (
            <div className="border border-[var(--border-subtle)] rounded divide-y divide-[var(--border-subtle)] text-xs bg-[var(--bg-surface-raised)]">
              {plannedMaterials.map((m) => (
                <div key={m.id} className="p-2.5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {m.materialCode && (
                      <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded">
                        {m.materialCode}
                      </span>
                    )}
                    <span className="font-medium text-[var(--text-primary)]">{m.materialName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--text-secondary)] font-mono font-semibold">
                      {m.quantity} {m.unit}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStartEditPlannedMaterial(m)}
                      title="Editar quantidade"
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-xs cursor-pointer"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemovePlannedMaterial(m.id)}
                      title="Remover material"
                      className="text-[var(--text-muted)] hover:text-rose-500 font-bold text-sm leading-none cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic">
              Nenhum material planejado adicionado a esta atividade.
            </p>
          )}
        </div>

        {/* Bloco 6: Observações */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-[var(--text-secondary)]">
            Observações Operacionais
          </label>
          <textarea
            rows={2}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            className="w-full text-sm border border-[var(--border-medium)] rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

        {/* Bloco 7: Fotos e Evidências Fotográficas */}
        <div className="space-y-3 p-4 rounded-lg bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-mono flex items-center gap-2">
                <span>Fotos e Evidências da Atividade</span>
                <span className="text-[10px] font-normal text-[var(--text-muted)] lowercase">
                  ({existingPhotos.length - photoIdsToDelete.length + newPhotoFiles.length}/8 fotos)
                </span>
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Formatos permitidos: JPG, PNG, WEBP (máximo de 5 MB por arquivo).
              </p>
            </div>

            {loadingPhotos && (
              <span className="text-[11px] text-blue-500 font-mono animate-pulse">
                Carregando fotos...
              </span>
            )}
          </div>

          {/* Input de Seleção de Arquivos */}
          <div className="relative">
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              disabled={
                isSubmitting ||
                existingPhotos.length - photoIdsToDelete.length + newPhotoFiles.length >= 8
              }
              className="block w-full text-xs text-[var(--text-secondary)] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Galeria de Fotos Existentes (Modo Edição) */}
          {existingPhotos.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                Fotos Cadastradas Anteriormente:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {existingPhotos.map((photo) => {
                  const isMarkedForDeletion = photoIdsToDelete.includes(photo.id);
                  return (
                    <div
                      key={photo.id}
                      className={`relative group rounded-md overflow-hidden border transition-all ${
                        isMarkedForDeletion
                          ? "border-rose-500/60 opacity-40 grayscale"
                          : "border-[var(--border-subtle)] hover:border-blue-500/40 bg-[var(--bg-surface)]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.signedUrl || ""}
                        alt={photo.originalFilename}
                        className="w-full h-24 object-cover"
                      />
                      <div className="p-1.5 bg-[var(--bg-surface-raised)]/95 flex items-center justify-between text-[10px]">
                        <span className="truncate max-w-[100px] text-[var(--text-secondary)]" title={photo.originalFilename}>
                          {photo.originalFilename}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleDeleteExistingPhoto(photo.id)}
                          title={isMarkedForDeletion ? "Desfazer remoção" : "Remover foto"}
                          className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                            isMarkedForDeletion
                              ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                              : "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                          }`}
                        >
                          {isMarkedForDeletion ? "Restaurar" : "✕ Excluir"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Galeria de Novas Fotos Pré-selecionadas */}
          {newPhotoPreviews.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 font-mono">
                Novas Fotos Prontas para Envio:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {newPhotoPreviews.map((item, idx) => (
                  <div
                    key={item.id}
                    className="relative group rounded-md overflow-hidden border border-emerald-500/30 bg-[var(--bg-surface)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="w-full h-24 object-cover"
                    />
                    <div className="p-1.5 bg-[var(--bg-surface-raised)]/95 flex items-center justify-between text-[10px]">
                      <span className="truncate max-w-[100px] text-[var(--text-primary)]" title={item.file.name}>
                        {item.file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveNewPhoto(idx)}
                        title="Remover foto antes de salvar"
                        className="text-rose-500 hover:text-rose-400 font-bold px-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Ações do Formulário */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-highlight)] rounded border border-[var(--border-subtle)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
