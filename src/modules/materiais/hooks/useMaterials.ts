"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Material, NewMaterialInput, StockEntryInput } from "../types/material.types";
import {
  getMaterials,
  createMaterial as createMaterialService,
  updateMaterial as updateMaterialService,
  deleteMaterial as deleteMaterialService,
  registerStockEntry as registerStockEntryService,
  mapRowToMaterial,
  SupabaseMaterialRow,
} from "../services/material.service";
import { createClient } from "@/lib/supabase/client";

export function useMaterials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  const loadMaterials = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMaterials();
      setMaterials(data);
      if (selectedMaterial) {
        const refreshed = data.find((m) => m.id === selectedMaterial.id);
        if (refreshed) setSelectedMaterial(refreshed);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar materiais.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMaterial]);

  useEffect(() => {
    loadMaterials();
  }, []);

  // ----------------------------------------------------------------------------
  // Sincronização em Tempo Real (Supabase Realtime)
  // ----------------------------------------------------------------------------
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("realtime-materials-channel")
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
            setSelectedMaterial((curr) =>
              curr?.id === updatedMaterial.id ? updatedMaterial : curr
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            setMaterials((prev) => prev.filter((m) => m.id !== deletedId));
            setSelectedMaterial((curr) => (curr?.id === deletedId ? null : curr));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addNewMaterial = async (input: NewMaterialInput): Promise<Material> => {
    const created = await createMaterialService(input);
    setMaterials((prev) => [created, ...prev]);
    setSelectedMaterial(created);
    return created;
  };

  const editMaterial = async (
    id: string,
    input: NewMaterialInput & { active?: boolean }
  ): Promise<Material> => {
    const updated = await updateMaterialService(id, input);
    setMaterials((prev) => prev.map((m) => (m.id === id ? updated : m)));
    if (selectedMaterial?.id === id) {
      setSelectedMaterial(updated);
    }
    return updated;
  };

  const removeMaterial = async (id: string): Promise<void> => {
    const inactived = await deleteMaterialService(id);
    setMaterials((prev) => prev.map((m) => (m.id === id ? inactived : m)));
    if (selectedMaterial?.id === id) {
      setSelectedMaterial(inactived);
    }
  };

  const addStockEntry = async (input: StockEntryInput) => {
    const result = await registerStockEntryService(input);
    setMaterials((prev) =>
      prev.map((m) =>
        m.id === input.materialId
          ? {
              ...m,
              currentStock: result.newStock,
              status:
                result.newStock < m.minimumStock
                  ? "critico"
                  : result.newStock <= m.minimumStock * 1.15
                  ? "atencao"
                  : "adequado",
            }
          : m
      )
    );
    if (selectedMaterial && selectedMaterial.id === input.materialId) {
      setSelectedMaterial((prev) =>
        prev
          ? {
              ...prev,
              currentStock: result.newStock,
              status:
                result.newStock < prev.minimumStock
                  ? "critico"
                  : result.newStock <= prev.minimumStock * 1.15
                  ? "atencao"
                  : "adequado",
            }
          : null
      );
    }
    return result;
  };

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      if (search.trim()) {
        const term = search.toLowerCase();
        const matchesCode = m.code.toLowerCase().includes(term);
        const matchesName = m.name.toLowerCase().includes(term);
        const matchesType = m.type.toLowerCase().includes(term);
        if (!matchesCode && !matchesName && !matchesType) return false;
      }
      if (statusFilter !== "todos" && m.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [materials, search, statusFilter]);

  return {
    materials: filteredMaterials,
    rawMaterials: materials,
    selectedMaterial,
    setSelectedMaterial,
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

