"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Material,
  MaterialPlanningMetrics,
  MaterialPlanningSummary,
  NewMaterialInput,
  PlanningPeriodFilter,
  StockEntryInput,
} from "../types/material.types";
import {
  getMaterials,
  createMaterial as createMaterialService,
  updateMaterial as updateMaterialService,
  deleteMaterial as deleteMaterialService,
  registerStockEntry as registerStockEntryService,
  mapRowToMaterial,
  SupabaseMaterialRow,
} from "../services/material.service";
import { getMaterialsPlanningMetrics } from "../services/material-planning.service";
import { createClient } from "@/lib/supabase/client";

export function useMaterials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [planningMetricsList, setPlanningMetricsList] = useState<MaterialPlanningMetrics[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [period, setPeriod] = useState<PlanningPeriodFilter>("semana");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros de busca
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  // Carregar materiais e consolidar com planejamento
  const loadMaterials = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const mats = await getMaterials();
      setMaterials(mats);

      const metrics = await getMaterialsPlanningMetrics(mats, period);
      setPlanningMetricsList(metrics);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar catálogo e planejamento.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  // Sincronização em tempo real (Supabase Realtime para materials)
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("realtime-materials-planning-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "materials",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMaterial = mapRowToMaterial(payload.new as SupabaseMaterialRow);
            setMaterials((prev) => {
              if (prev.some((m) => m.id === newMaterial.id)) return prev;
              return [newMaterial, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedMaterial = mapRowToMaterial(payload.new as SupabaseMaterialRow);
            setMaterials((prev) =>
              prev.map((m) => (m.id === updatedMaterial.id ? updatedMaterial : m))
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            setMaterials((prev) => prev.filter((m) => m.id !== deletedId));
          }
          // Recarregar métricas para garantir sincronia física
          loadMaterials();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMaterials]);

  const addNewMaterial = async (input: NewMaterialInput): Promise<Material> => {
    const created = await createMaterialService(input);
    await loadMaterials();
    setSelectedMaterialId(created.id);
    return created;
  };

  const editMaterial = async (
    id: string,
    input: NewMaterialInput & { active?: boolean }
  ): Promise<Material> => {
    const updated = await updateMaterialService(id, input);
    await loadMaterials();
    return updated;
  };

  const removeMaterial = async (id: string): Promise<void> => {
    const inactived = await deleteMaterialService(id);
    await loadMaterials();
    if (selectedMaterialId === id) {
      setSelectedMaterialId(null);
    }
  };

  const addStockEntry = async (input: StockEntryInput) => {
    const result = await registerStockEntryService(input);
    await loadMaterials();
    return result;
  };

  // Filtragem dos cards de planejamento
  const filteredMetrics = useMemo(() => {
    return planningMetricsList.filter((item) => {
      const m = item.material;
      if (search.trim()) {
        const term = search.toLowerCase();
        const matchesCode = m.code.toLowerCase().includes(term);
        const matchesName = m.name.toLowerCase().includes(term);
        const matchesType = m.type.toLowerCase().includes(term);
        if (!matchesCode && !matchesName && !matchesType) return false;
      }

      if (statusFilter !== "todos") {
        if (statusFilter === "adequado" && item.projectedStatus !== "adequado") return false;
        if (statusFilter === "atencao" && item.projectedStatus !== "atencao") return false;
        if (statusFilter === "critico" && item.projectedStatus !== "critico") return false;
      }

      return true;
    });
  }, [planningMetricsList, search, statusFilter]);

  // Material e métricas selecionadas
  const selectedMetrics = useMemo(() => {
    if (!selectedMaterialId) return null;
    return planningMetricsList.find((pm) => pm.material.id === selectedMaterialId) || null;
  }, [planningMetricsList, selectedMaterialId]);

  const selectedMaterial = useMemo(() => {
    return selectedMetrics ? selectedMetrics.material : null;
  }, [selectedMetrics]);

  // Indicadores de resumo do topo da tela
  const summary: MaterialPlanningSummary = useMemo(() => {
    let atRiskCount = 0;
    let insufficientCount = 0;
    let totalPlannedVolume = 0;
    let totalConsumedVolume = 0;

    for (const item of planningMetricsList) {
      if (item.projectedStatus === "atencao") atRiskCount++;
      if (item.projectedStatus === "critico") insufficientCount++;
      totalPlannedVolume += item.plannedOriginal;
      totalConsumedVolume += item.consumedReal;
    }

    return {
      totalMaterialsCount: planningMetricsList.length,
      atRiskCount,
      insufficientCount,
      totalPlannedVolume: Math.round(totalPlannedVolume * 100) / 100,
      totalConsumedVolume: Math.round(totalConsumedVolume * 100) / 100,
    };
  }, [planningMetricsList]);

  return {
    materials,
    rawMaterials: materials,
    planningMetricsList: filteredMetrics,
    selectedMetrics,
    selectedMaterial,
    selectedMaterialId,
    setSelectedMaterialId,
    setSelectedMaterial: (m: Material | null) => setSelectedMaterialId(m ? m.id : null),
    period,
    setPeriod,
    summary,
    isLoading,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    loadMaterials,
    addNewMaterial,
    editMaterial,
    removeMaterial,
    addStockEntry,
  };
}
