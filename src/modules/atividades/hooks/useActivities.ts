"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Activity } from "../types/activity.types";
import { 
  fetchActivities, 
  getActivityById,
  createActivity, 
  updateActivity as updateActivityService, 
  archiveActivity as archiveActivityService 
} from "../services/activity.service";
import { createClient } from "@/lib/supabase/client";

/**
 * Garante que a lista de atividades permaneça estritamente desduplicada por ID ou número de OS (orderNumber).
 * Caso o registro já exista no estado, substitui com os dados mais recentes; caso contrário, prepende à lista.
 */
function upsertActivityInList(list: Activity[], item: Activity): Activity[] {
  const itemOrderNum = item.orderNumber ? item.orderNumber.toUpperCase().trim() : "";
  const existsIndex = list.findIndex(
    (a) =>
      a.id === item.id ||
      (itemOrderNum && a.orderNumber && a.orderNumber.toUpperCase().trim() === itemOrderNum)
  );

  if (existsIndex >= 0) {
    return list.map((a, idx) => (idx === existsIndex ? item : a));
  }

  return [item, ...list];
}

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de Filtros e Busca
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [areaFilter, setAreaFilter] = useState("todas");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const loadActivities = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchActivities();
      // Desduplica por ID e por orderNumber para integridade absoluta
      const uniqueData: Activity[] = [];
      for (const item of data) {
        const itemOrderNum = item.orderNumber ? item.orderNumber.toUpperCase().trim() : "";
        const exists = uniqueData.some(
          (u) =>
            u.id === item.id ||
            (itemOrderNum && u.orderNumber && u.orderNumber.toUpperCase().trim() === itemOrderNum)
        );
        if (!exists) {
          uniqueData.push(item);
        }
      }

      setActivities(uniqueData);
      if (selectedActivity) {
        const refreshed = uniqueData.find((a) => a.id === selectedActivity.id);
        if (refreshed) setSelectedActivity(refreshed);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar dados do Supabase.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedActivity]);

  useEffect(() => {
    loadActivities();
  }, []);

  // ----------------------------------------------------------------------------
  // Sincronização em Tempo Real (Supabase Realtime)
  // ----------------------------------------------------------------------------
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("realtime-activities-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activities",
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newId = (payload.new as { id: string }).id;
            const fullActivity = await getActivityById(newId);
            if (fullActivity && !fullActivity.archivedAt) {
              setActivities((prev) => upsertActivityInList(prev, fullActivity));
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedId = (payload.new as { id: string }).id;
            const fullActivity = await getActivityById(updatedId);
            if (fullActivity) {
              if (fullActivity.archivedAt) {
                // Se foi arquivada, remove da listagem operacional ativa
                setActivities((prev) => prev.filter((a) => a.id !== updatedId));
                setSelectedActivity((curr) => (curr?.id === updatedId ? null : curr));
              } else {
                setActivities((prev) => upsertActivityInList(prev, fullActivity));
                setSelectedActivity((curr) => (curr?.id === updatedId ? fullActivity : curr));
              }
            }
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            setActivities((prev) => prev.filter((a) => a.id !== deletedId));
            setSelectedActivity((curr) => (curr?.id === deletedId ? null : curr));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Lista de áreas únicas para o filtro
  const availableAreas = useMemo(() => {
    const areas = new Set<string>();
    activities.forEach((act) => {
      if (act.location?.area) {
        areas.add(act.location.area);
      }
    });
    return Array.from(areas);
  }, [activities]);

  // Lista filtrada e ordenada
  const filteredActivities = useMemo(() => {
    return activities
      .filter((activity) => {
        // Busca textual
        if (search.trim()) {
          const term = search.toLowerCase();
          const matchesNota = activity.orderNumber.toLowerCase().includes(term);
          const matchesName = activity.name.toLowerCase().includes(term);
          const matchesResp = activity.assignedTo?.toLowerCase().includes(term) ?? false;
          const matchesTag = activity.tags.some((t) => t.code.toLowerCase().includes(term));
          if (!matchesNota && !matchesName && !matchesResp && !matchesTag) {
            return false;
          }
        }

        // Filtro por Status
        if (statusFilter !== "todos" && activity.status !== statusFilter) {
          return false;
        }

        // Filtro por Área
        if (areaFilter !== "todas" && activity.location.area !== areaFilter) {
          return false;
        }

        // Filtro por Período Planejado
        if (startDate && activity.schedule.plannedStartDate < startDate) {
          return false;
        }
        if (endDate && activity.schedule.plannedEndDate > endDate) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = a.schedule.plannedStartDate;
        const dateB = b.schedule.plannedStartDate;
        if (sortOrder === "asc") {
          return dateA.localeCompare(dateB);
        } else {
          return dateB.localeCompare(dateA);
        }
      });
  }, [activities, search, statusFilter, areaFilter, startDate, endDate, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const addActivity = async (newActivity: Activity) => {
    try {
      const persisted = await createActivity(newActivity);
      setActivities((prev) => upsertActivityInList(prev, persisted));
      setSelectedActivity(persisted);
      return persisted;
    } catch (err) {
      console.error("Erro ao persistir atividade no Supabase:", err);
      const msg = err instanceof Error ? err.message : "Falha ao salvar atividade no banco.";
      setError(msg);
      throw err;
    }
  };

  const updateActivity = async (updatedActivity: Activity) => {
    try {
      const persisted = await updateActivityService(updatedActivity);
      setActivities((prev) => upsertActivityInList(prev, persisted));
      setSelectedActivity(persisted);
      return persisted;
    } catch (err) {
      console.error("Erro ao atualizar atividade no Supabase:", err);
      throw err;
    }
  };

  const archiveActivity = async (activityId: string, reason?: string) => {
    try {
      await archiveActivityService(activityId, reason);
      // Remove da listagem ativa imediatamente
      setActivities((prev) => prev.filter((act) => act.id !== activityId));
      if (selectedActivity?.id === activityId) {
        setSelectedActivity(null);
      }
    } catch (err) {
      console.error("Erro ao arquivar atividade no Supabase:", err);
      throw err;
    }
  };

  return {
    activities: filteredActivities,
    rawActivities: activities,
    selectedActivity,
    setSelectedActivity,
    isLoading,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    areaFilter,
    setAreaFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    sortOrder,
    toggleSortOrder,
    availableAreas,
    addActivity,
    updateActivity,
    archiveActivity,
  };
}
