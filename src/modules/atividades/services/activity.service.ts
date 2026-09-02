import { createClient } from "@/lib/supabase/client";
import { Activity, ActivityPriority, ActivityStatus, ActivityHistoryEntry } from "../types/activity.types";
import { MOCK_ACTIVITIES } from "./activity.mock";

/**
 * Interface do registro retornado pelo Supabase para public.activities com JOINs
 */
interface SupabaseActivityRow {
  id: string;
  order_number: string;
  name: string;
  service_type: string;
  description: string;
  origin_reference: string | null;
  status: string;
  priority: string;
  progress_percentage: number;
  service_quantity: number | null;
  service_unit: string | null;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date: string | null;
  actual_end_date: string | null;
  observations: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  archived_at?: string | null;
  archived_by_user_id?: string | null;
  archive_reason?: string | null;
  created_at: string;
  updated_at: string;
  custom_location_text: string | null;
  areas: { id: string; name: string; code: string } | null;
  locations: { id: string; name: string } | null;
  equipments: { id: string; name: string } | null;
  teams: { id: string; name: string } | null;
  users: { id: string; full_name: string; email: string } | null;
  activity_tags: Array<{ id: string; tag_code: string; is_main: boolean }> | null;
  activity_planned_materials: Array<{
    id: string;
    material_id?: string | null;
    custom_material_name: string;
    planned_quantity: number;
    unit: string;
    materials: { id?: string; code?: string; name: string } | null;
  }> | null;
}

/**
 * Transforma uma linha do Supabase (snake_case com relacionamentos) no modelo de domínio Activity (camelCase).
 */
function mapRowToActivity(row: SupabaseActivityRow): Activity {
  const areaName = row.areas?.name || "Área Não Definida";
  const localName = row.locations?.name || "Local Geral";
  const equipName = row.equipments?.name || row.custom_location_text || "Não especificado";

  return {
    id: row.id,
    orderNumber: row.order_number,
    name: row.name,
    serviceType: row.service_type,
    description: row.description,
    originReference: row.origin_reference || undefined,
    status: (row.status || "programada") as ActivityStatus,
    priority: (row.priority || "media") as ActivityPriority,
    progressPercentage: Number(row.progress_percentage || 0),
    serviceQuantity: row.service_quantity ? Number(row.service_quantity) : undefined,
    serviceUnit: row.service_unit || "m²",
    location: {
      area: areaName,
      local: localName,
      equipment: equipName,
    },
    assignedTo: row.users?.full_name || undefined,
    team: row.teams?.name || undefined,
    observations: row.observations || undefined,
    tags: (row.activity_tags || []).map((t) => ({
      id: t.id,
      code: t.tag_code,
    })),
    plannedMaterials: (row.activity_planned_materials || []).map((pm) => ({
      id: pm.id,
      materialId: pm.material_id || pm.materials?.id || undefined,
      materialCode: pm.materials?.code || undefined,
      materialName: pm.materials?.name || pm.custom_material_name,
      quantity: Number(pm.planned_quantity),
      unit: pm.unit,
    })),
    schedule: {
      plannedStartDate: row.planned_start_date,
      plannedEndDate: row.planned_end_date,
      actualStartDate: row.actual_start_date || undefined,
      actualEndDate: row.actual_end_date || undefined,
      teamName: row.teams?.name || undefined,
    },
    consumptions: [], // Carregado separadamente quando a migration de consumos for aplicada
    history: [],      // Carregado separadamente quando a migration de auditoria for aplicada
    archivedAt: row.archived_at || undefined,
    archivedBy: row.archived_by_user_id || undefined,
    archiveReason: row.archive_reason || undefined,
    createdAt: row.created_at ? row.created_at.split("T")[0] : "",
    updatedAt: row.updated_at ? row.updated_at.split("T")[0] : "",
  };
}

/**
 * Busca as atividades reais ATIVAS cadastradas em public.activities no Supabase
 * (filtrando estritamente archived_at IS NULL para a tela principal e operações ativas).
 */
export async function getActivities(preferRealData = true): Promise<Activity[]> {
  if (!preferRealData) {
    return MOCK_ACTIVITIES.filter((a) => !a.archivedAt);
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from("activities")
    .select(`
      id,
      order_number,
      name,
      service_type,
      description,
      origin_reference,
      status,
      priority,
      progress_percentage,
      service_quantity,
      service_unit,
      planned_start_date,
      planned_end_date,
      actual_start_date,
      actual_end_date,
      observations,
      cancellation_reason,
      cancelled_at,
      archived_at,
      archived_by_user_id,
      archive_reason,
      created_at,
      updated_at,
      custom_location_text,
      areas (id, name, code),
      locations (id, name),
      equipments (id, name),
      teams (id, name),
      users!activities_assigned_user_id_fkey (id, full_name, email),
      activity_tags (id, tag_code, is_main),
      activity_planned_materials (
        id,
        material_id,
        custom_material_name,
        planned_quantity,
        unit,
        materials (id, code, name)
      )
    `)
    .is("archived_at", null)
    .order("planned_start_date", { ascending: true });

  if (error) {
    console.error("[getActivities] Erro retornado pelo Supabase:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(`Falha ao carregar atividades do Supabase: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return (data as unknown as SupabaseActivityRow[]).map(mapRowToActivity);
}

/**
 * Busca todas as atividades para a tela de Histórico (incluindo ativas, concluídas, canceladas e arquivadas).
 */
export async function getHistoryActivities(preferRealData = true): Promise<Activity[]> {
  if (!preferRealData) {
    return MOCK_ACTIVITIES;
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from("activities")
    .select(`
      id,
      order_number,
      name,
      service_type,
      description,
      origin_reference,
      status,
      priority,
      progress_percentage,
      service_quantity,
      service_unit,
      planned_start_date,
      planned_end_date,
      actual_start_date,
      actual_end_date,
      observations,
      cancellation_reason,
      cancelled_at,
      archived_at,
      archived_by_user_id,
      archive_reason,
      created_at,
      updated_at,
      custom_location_text,
      areas (id, name, code),
      locations (id, name),
      equipments (id, name),
      teams (id, name),
      users!activities_assigned_user_id_fkey (id, full_name, email),
      activity_tags (id, tag_code, is_main),
      activity_planned_materials (
        id,
        material_id,
        custom_material_name,
        planned_quantity,
        unit,
        materials (id, code, name)
      )
    `)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[getHistoryActivities] Erro retornado pelo Supabase:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(`Falha ao carregar histórico de atividades: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return (data as unknown as SupabaseActivityRow[]).map(mapRowToActivity);
}

/**
 * Busca uma atividade específica pelo ID com todos os relacionamentos completos.
 */
export async function getActivityById(activityId: string): Promise<Activity | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("activities")
    .select(`
      id,
      order_number,
      name,
      service_type,
      description,
      origin_reference,
      status,
      priority,
      progress_percentage,
      service_quantity,
      service_unit,
      planned_start_date,
      planned_end_date,
      actual_start_date,
      actual_end_date,
      observations,
      cancellation_reason,
      cancelled_at,
      archived_at,
      archived_by_user_id,
      archive_reason,
      created_at,
      updated_at,
      custom_location_text,
      areas (id, name, code),
      locations (id, name),
      equipments (id, name),
      teams (id, name),
      users!activities_assigned_user_id_fkey (id, full_name, email),
      activity_tags (id, tag_code, is_main),
      activity_planned_materials (
        id,
        custom_material_name,
        planned_quantity,
        unit,
        materials (name)
      )
    `)
    .eq("id", activityId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapRowToActivity(data as unknown as SupabaseActivityRow);
}

/**
 * Cria uma nova atividade no Supabase garantindo a resolução correta de chaves estrangeiras,
 * inserção de tags, materiais planejados e log inicial de auditoria.
 */
export async function createActivity(activity: Activity): Promise<Activity> {
  const supabase = createClient();

  // 1. Obter usuário autenticado atual (não confiar em dados soltos do client)
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // 2. Resolver área (obrigatória no schema)
  let areaId: string | null = null;
  if (activity.location?.area) {
    const { data: areaData } = await supabase
      .from("areas")
      .select("id")
      .eq("name", activity.location.area)
      .maybeSingle();

    if (areaData) {
      areaId = areaData.id;
    } else {
      // Se for área personalizada cadastrada como "Outro", busca ou cria
      const { data: newArea } = await supabase
        .from("areas")
        .insert({
          name: activity.location.area,
          code: activity.location.area.substring(0, 3).toUpperCase(),
          active: true,
        })
        .select("id")
        .single();
      if (newArea) areaId = newArea.id;
    }
  }

  if (!areaId) {
    throw new Error("Não foi possível resolver a Área para persistência no banco de dados.");
  }

  // 3. Resolver local (obrigatório no schema vinculado à área)
  let locationId: string | null = null;
  const localName = activity.location?.local || "Geral";
  const { data: locData } = await supabase
    .from("locations")
    .select("id")
    .eq("area_id", areaId)
    .eq("name", localName)
    .maybeSingle();

  if (locData) {
    locationId = locData.id;
  } else {
    const { data: newLoc } = await supabase
      .from("locations")
      .insert({ area_id: areaId, name: localName })
      .select("id")
      .single();
    if (newLoc) locationId = newLoc.id;
  }

  if (!locationId) {
    throw new Error("Não foi possível resolver o Local para persistência no banco de dados.");
  }

  // 4. Resolver equipamento (opcional)
  let equipmentId: string | null = null;
  let customLocationText: string | null = null;
  if (activity.location?.equipment && activity.location.equipment !== "Não especificado") {
    const { data: eqData } = await supabase
      .from("equipments")
      .select("id")
      .eq("location_id", locationId)
      .eq("name", activity.location.equipment)
      .maybeSingle();

    if (eqData) {
      equipmentId = eqData.id;
    } else {
      customLocationText = activity.location.equipment;
    }
  }

  // 5. Resolver equipe (opcional)
  let teamId: string | null = null;
  if (activity.team) {
    const { data: teamData } = await supabase
      .from("teams")
      .select("id")
      .eq("name", activity.team)
      .maybeSingle();
    if (teamData) teamId = teamData.id;
  }

  // 6. Resolver responsável em public.users (opcional)
  let assignedUserId: string | null = null;
  if (activity.assignedTo) {
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("full_name", activity.assignedTo)
      .maybeSingle();
    if (userData) assignedUserId = userData.id;
  }

  // 7. Inserir a Atividade principal em public.activities
  const { data: insertedActivity, error: activityError } = await supabase
    .from("activities")
    .insert({
      order_number: activity.orderNumber.toUpperCase().trim(),
      name: activity.name.trim(),
      service_type: activity.serviceType || "Pintura Geral",
      description: activity.description?.trim() || activity.name.trim(),
      origin_reference: activity.originReference?.trim() || null,
      area_id: areaId,
      location_id: locationId,
      equipment_id: equipmentId,
      custom_location_text: customLocationText,
      status: activity.status || "programada",
      priority: activity.priority || "media",
      progress_percentage: activity.progressPercentage || 0,
      assigned_user_id: assignedUserId,
      team_id: teamId,
      service_quantity: activity.serviceQuantity || null,
      service_unit: activity.serviceUnit || "m²",
      planned_start_date: activity.schedule.plannedStartDate,
      planned_end_date: activity.schedule.plannedEndDate,
      observations: activity.observations?.trim() || null,
    })
    .select("id, created_at, updated_at")
    .single();

  if (activityError || !insertedActivity) {
    throw new Error(`Erro ao persistir atividade no Supabase: ${activityError?.message}`);
  }

  const newActivityId = insertedActivity.id;

  try {
    // 8. Inserir Tags em public.activity_tags
    if (activity.tags && activity.tags.length > 0) {
      const tagsToInsert = activity.tags.map((t, idx) => ({
        activity_id: newActivityId,
        tag_code: t.code.toUpperCase().trim(),
        is_main: idx === 0,
      }));

      const { error: tagsError } = await supabase
        .from("activity_tags")
        .insert(tagsToInsert);

      if (tagsError) {
        console.warn("Aviso ao salvar tags da atividade:", tagsError.message);
      }
    }

    // 9. Inserir Materiais Planejados em public.activity_planned_materials
    if (activity.plannedMaterials && activity.plannedMaterials.length > 0) {
      const plannedToInsert = [];

      for (const pm of activity.plannedMaterials) {
        let materialId: string | null = pm.materialId || null;

        // Se não foi passado materialId, tenta vincular ao catálogo pelo nome
        if (!materialId) {
          const { data: matData } = await supabase
            .from("materials")
            .select("id")
            .eq("name", pm.materialName)
            .maybeSingle();

          if (matData) {
            materialId = matData.id;
          }
        }

        plannedToInsert.push({
          activity_id: newActivityId,
          material_id: materialId,
          custom_material_name: pm.materialName,
          planned_quantity: pm.quantity,
          unit: pm.unit,
        });
      }

      const { error: matError } = await supabase
        .from("activity_planned_materials")
        .insert(plannedToInsert);

      if (matError) {
        console.warn("Aviso ao salvar materiais planejados:", matError.message);
      }
    }

    // 10. Inserir Registro Inicial de Auditoria em public.activity_audit_logs (se tabela existir)
    if (authUser) {
      const { error: auditError } = await supabase.from("activity_audit_logs").insert({
        activity_id: newActivityId,
        user_id: authUser.id,
        action: "Criação da Atividade",
        field: "Status",
        old_value: null,
        new_value: (activity.status || "programada").toUpperCase(),
        new_progress: 0,
        observation: activity.observations || "Atividade cadastrada com status PROGRAMADA",
      });

      if (auditError) {
        // Log seguro caso a migration 000006 ainda não tenha sido rodada no ambiente
        console.info("Info: Tabela activity_audit_logs ainda não ativa no banco ou sem permissão direta:", auditError.message);
      }
    }
  } catch (secondaryError) {
    console.error("Erro secundário durante persistência de dependências da atividade:", secondaryError);
  }

  // Retorna a entidade com o ID real gerado pelo Supabase
  return {
    ...activity,
    id: newActivityId,
    createdAt: insertedActivity.created_at.split("T")[0],
    updatedAt: insertedActivity.updated_at.split("T")[0],
  };
}

/**
 * Atualiza uma atividade existente no Supabase via UPDATE estrito por ID.
 * NÃO cria uma nova atividade, NÃO altera o UUID/id e atualiza relacionamentos e log de auditoria.
 */
export async function updateActivity(activity: Activity): Promise<Activity> {
  const supabase = createClient();

  if (!activity.id) {
    throw new Error("ID da atividade é obrigatório para atualização.");
  }

  // 1. Obter usuário autenticado atual para auditoria
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // 2. Resolver área
  let areaId: string | null = null;
  if (activity.location?.area) {
    const { data: areaData } = await supabase
      .from("areas")
      .select("id")
      .eq("name", activity.location.area)
      .maybeSingle();

    if (areaData) {
      areaId = areaData.id;
    } else {
      const { data: newArea } = await supabase
        .from("areas")
        .insert({
          name: activity.location.area,
          code: activity.location.area.substring(0, 3).toUpperCase(),
          active: true,
        })
        .select("id")
        .single();
      if (newArea) areaId = newArea.id;
    }
  }

  if (!areaId) {
    throw new Error("Não foi possível resolver a Área para atualização no banco de dados.");
  }

  // 3. Resolver local vinculado à área
  let locationId: string | null = null;
  const localName = activity.location?.local || "Geral";
  const { data: locData } = await supabase
    .from("locations")
    .select("id")
    .eq("area_id", areaId)
    .eq("name", localName)
    .maybeSingle();

  if (locData) {
    locationId = locData.id;
  } else {
    const { data: newLoc } = await supabase
      .from("locations")
      .insert({ area_id: areaId, name: localName })
      .select("id")
      .single();
    if (newLoc) locationId = newLoc.id;
  }

  if (!locationId) {
    throw new Error("Não foi possível resolver o Local para atualização no banco de dados.");
  }

  // 4. Resolver equipamento
  let equipmentId: string | null = null;
  let customLocationText: string | null = null;
  if (activity.location?.equipment && activity.location.equipment !== "Não especificado") {
    const { data: eqData } = await supabase
      .from("equipments")
      .select("id")
      .eq("location_id", locationId)
      .eq("name", activity.location.equipment)
      .maybeSingle();

    if (eqData) {
      equipmentId = eqData.id;
    } else {
      customLocationText = activity.location.equipment;
    }
  }

  // 5. Resolver equipe
  let teamId: string | null = null;
  if (activity.team) {
    const { data: teamData } = await supabase
      .from("teams")
      .select("id")
      .eq("name", activity.team)
      .maybeSingle();
    if (teamData) teamId = teamData.id;
  }

  // 6. Resolver responsável em public.users
  let assignedUserId: string | null = null;
  if (activity.assignedTo) {
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("full_name", activity.assignedTo)
      .maybeSingle();
    if (userData) assignedUserId = userData.id;
  }

  // 7. Executar UPDATE principal em public.activities pelo ID existente
  const { data: updatedActivityRow, error: updateError } = await supabase
    .from("activities")
    .update({
      name: activity.name.trim(),
      service_type: activity.serviceType || "Pintura Geral",
      description: activity.description?.trim() || activity.name.trim(),
      origin_reference: activity.originReference?.trim() || null,
      area_id: areaId,
      location_id: locationId,
      equipment_id: equipmentId,
      custom_location_text: customLocationText,
      priority: activity.priority || "media",
      assigned_user_id: assignedUserId,
      team_id: teamId,
      service_quantity: activity.serviceQuantity || null,
      service_unit: activity.serviceUnit || "m²",
      planned_start_date: activity.schedule.plannedStartDate,
      planned_end_date: activity.schedule.plannedEndDate,
      observations: activity.observations?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", activity.id)
    .select("id, updated_at")
    .single();

  if (updateError || !updatedActivityRow) {
    throw new Error(`Erro ao atualizar atividade no Supabase: ${updateError?.message}`);
  }

  try {
    // 8. Atualizar Tags (substituição controlada)
    if (activity.tags && activity.tags.length > 0) {
      await supabase.from("activity_tags").delete().eq("activity_id", activity.id);

      const tagsToInsert = activity.tags.map((t, idx) => ({
        activity_id: activity.id,
        tag_code: t.code.toUpperCase().trim(),
        is_main: idx === 0,
      }));

      await supabase.from("activity_tags").insert(tagsToInsert);
    }

    // 9. Atualizar Materiais Planejados
    if (activity.plannedMaterials && activity.plannedMaterials.length > 0) {
      await supabase.from("activity_planned_materials").delete().eq("activity_id", activity.id);

      const plannedToInsert = [];
      for (const pm of activity.plannedMaterials) {
        let materialId: string | null = pm.materialId || null;
        if (!materialId) {
          const { data: matData } = await supabase
            .from("materials")
            .select("id")
            .eq("name", pm.materialName)
            .maybeSingle();

          if (matData) materialId = matData.id;
        }

        plannedToInsert.push({
          activity_id: activity.id,
          material_id: materialId,
          custom_material_name: pm.materialName,
          planned_quantity: pm.quantity,
          unit: pm.unit,
        });
      }

      await supabase.from("activity_planned_materials").insert(plannedToInsert);
    }

    // 10. Registrar Log de Auditoria da Edição
    if (authUser) {
      await supabase.from("activity_audit_logs").insert({
        activity_id: activity.id,
        user_id: authUser.id,
        action: "Edição da Atividade",
        field: "Revisão Geral",
        old_value: null,
        new_value: "Dados atualizados",
        observation: activity.observations || "Atividade editada via formulário",
      });
    }
  } catch (secondaryError) {
    console.warn("Aviso durante atualização de entidades secundárias:", secondaryError);
  }

  return {
    ...activity,
    updatedAt: updatedActivityRow.updated_at.split("T")[0],
  };
}

/**
 * Cancela uma atividade existente no Supabase via RPC segura (public.cancel_activity).
 * Garante atomicidade, preservação de colunas e registro no log de auditoria.
 */
export async function cancelActivity(activityId: string, justification: string): Promise<Activity> {
  const supabase = createClient();

  if (!activityId) {
    throw new Error("ID da atividade é obrigatório para cancelamento.");
  }
  if (!justification.trim()) {
    throw new Error("A justificativa de cancelamento é obrigatória.");
  }

  // Executa a função RPC segura com SECURITY DEFINER no PostgreSQL
  const { error: rpcError } = await supabase.rpc("cancel_activity", {
    p_activity_id: activityId,
    p_cancellation_reason: justification.trim(),
  });

  if (rpcError) {
    throw new Error(`Erro ao cancelar atividade no Supabase: ${rpcError.message}`);
  }

  // Recarrega a atividade atualizada com todos os relacionamentos preenchidos
  const activities = await getActivities();
  const updated = activities.find((a) => a.id === activityId);

  if (!updated) {
    throw new Error("Atividade cancelada com sucesso, mas não foi possível recarregar seus dados.");
  }

  return updated;
}

/**
 * Arquiva uma atividade existente no Supabase via RPC segura (public.archive_activity).
 * Garante soft delete, preservação de integridade de dados e registro no log de auditoria.
 */
export async function archiveActivity(activityId: string, reason?: string): Promise<void> {
  const supabase = createClient();

  if (!activityId) {
    throw new Error("ID da atividade é obrigatório para arquivamento.");
  }

  const { error: rpcError } = await supabase.rpc("archive_activity", {
    p_activity_id: activityId,
    p_archive_reason: reason?.trim() || null,
  });

  if (rpcError) {
    throw new Error(`Erro ao arquivar atividade no Supabase: ${rpcError.message}`);
  }
}

/**
 * Exclui definitivamente uma atividade e todas as suas dependências do Supabase
 * via RPC segura atômica (public.delete_activity_permanently), removendo também
 * os arquivos físicos das fotos no bucket Storage 'activity-photos'.
 */
export async function deleteActivityPermanently(activityId: string): Promise<void> {
  const supabase = createClient();

  if (!activityId) {
    throw new Error("ID da atividade é obrigatório para exclusão definitiva.");
  }

  // 1. Executar exclusão atômica no banco via RPC
  const { data: rpcData, error: rpcError } = await supabase.rpc("delete_activity_permanently", {
    p_activity_id: activityId,
  });

  if (rpcError) {
    throw new Error(`Erro ao excluir atividade definitivamente: ${rpcError.message}`);
  }

  // 2. Limpeza dos arquivos físicos no Storage (se houver fotos deletadas)
  if (rpcData?.deleted_photo_paths && Array.isArray(rpcData.deleted_photo_paths) && rpcData.deleted_photo_paths.length > 0) {
    try {
      const { error: storageError } = await supabase.storage
        .from("activity-photos")
        .remove(rpcData.deleted_photo_paths);

      if (storageError) {
        console.warn("Aviso ao limpar fotos do storage:", storageError.message);
      }
    } catch (storageErr) {
      console.warn("Aviso durante remoção de arquivos no Storage:", storageErr);
    }
  }
}

/**
 * Busca o histórico real de auditoria de uma atividade em public.activity_audit_logs.
 */
export async function getActivityAuditHistory(activityId: string): Promise<ActivityHistoryEntry[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("activity_audit_logs")
    .select(`
      id,
      activity_id,
      user_id,
      user_name_cache,
      action,
      field,
      old_value,
      new_value,
      old_progress,
      new_progress,
      consumed_materials_json,
      observation,
      created_at,
      users (id, full_name, email)
    `)
    .eq("activity_id", activityId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getActivityAuditHistory] Erro ao buscar logs de auditoria:", error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((log) => {
    let consumedMaterials: Array<{ materialName: string; quantity: number; unit: string }> | undefined = undefined;
    if (log.consumed_materials_json && Array.isArray(log.consumed_materials_json)) {
      consumedMaterials = log.consumed_materials_json;
    }

    const userName = (log.users as { full_name?: string } | null)?.full_name || log.user_name_cache || "Sistema";

    return {
      id: log.id,
      timestamp: log.created_at ? new Date(log.created_at).toLocaleString("pt-BR") : "",
      userId: log.user_id || "",
      userName,
      action: log.action,
      field: log.field || undefined,
      oldValue: log.old_value || undefined,
      newValue: log.new_value || undefined,
      oldProgress: log.old_progress !== null ? log.old_progress : undefined,
      newProgress: log.new_progress !== null ? log.new_progress : undefined,
      consumedMaterials,
      observation: log.observation || undefined,
    };
  });
}

/**
 * Atualiza o progresso físico e registra consumo real atomicamente via RPC
 * public.update_activity_progress_and_consumption no Supabase com suporte
 * a débito atômico em materials.current_stock e registro em stock_movements.
 * Fotos são totalmente opcionais.
 */
export async function updateActivityProgress(
  activityId: string,
  newProgress: number,
  consumptionsList: Array<{ materialName: string; quantity: number; unit: string }> = [],
  observation?: string,
  photosPayload?: {
    files?: File[];
  },
  idempotencyKey?: string
): Promise<Activity> {
  const supabase = createClient();

  if (!idempotencyKey) {
    throw new Error("Idempotency key é obrigatória para atualização de atividade.");
  }

  // 1. Invocar RPC Atômica Transacional Idempotente
  const consumptionsPayload = consumptionsList.map((c) => ({
    custom_material_name: c.materialName,
    quantity: c.quantity,
    unit: c.unit,
  }));

  const { data: rpcResult, error: rpcErr } = await supabase.rpc(
    "update_activity_progress_and_consumption",
    {
      p_activity_id: activityId,
      p_new_progress: newProgress,
      p_consumptions: consumptionsPayload,
      p_observation: observation?.trim() || null,
      p_idempotency_key: idempotencyKey,
    }
  );

  if (rpcErr || !rpcResult) {
    console.error("[updateActivityProgress] Erro ao executar RPC no Supabase:", rpcErr);
    throw new Error(rpcErr?.message || "Erro desconhecido ao atualizar progresso da atividade.");
  }

  // 2. Se houver fotos (opcional) e a sessão puder ser iniciada
  if (photosPayload?.files && photosPayload.files.length > 0) {
    try {
      const { data: sessionData, error: sessionErr } = await supabase.rpc("start_photo_record_session", {
        p_activity_id: activityId,
        p_observation: observation?.trim() || null,
      });

      if (!sessionErr && sessionData?.photo_record_id) {
        const recordId = sessionData.photo_record_id;
        const uploadedPhotos: Array<{ storage_path: string; original_filename: string; file_size: number; mime_type: string }> = [];

        for (const file of photosPayload.files) {
          const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
          const photoId = crypto.randomUUID();
          const storagePath = `activities/${activityId}/${recordId}/${photoId}.${fileExt}`;

          const { error: uploadErr } = await supabase.storage
            .from("activity-photos")
            .upload(storagePath, file, {
              contentType: file.type || "image/jpeg",
              upsert: false,
            });

          if (!uploadErr) {
            uploadedPhotos.push({
              storage_path: storagePath,
              original_filename: file.name,
              file_size: file.size,
              mime_type: file.type || "image/jpeg",
            });
          }
        }

        if (uploadedPhotos.length > 0) {
          await supabase.rpc("confirm_photo_record_session", {
            p_photo_record_id: recordId,
            p_photos: uploadedPhotos,
          });
        } else {
          await supabase.rpc("abort_photo_record_session", {
            p_photo_record_id: recordId,
          });
        }
      }
    } catch (photoErr) {
      console.warn("Aviso ao processar fotos da evolução:", photoErr);
    }
  }

  // 3. Recarregar atividade atualizada
  const activities = await getActivities();
  const updated = activities.find((a) => a.id === activityId);
  if (!updated) {
    throw new Error("Atividade atualizada com sucesso, mas não pôde ser recarregada.");
  }

  return updated;
}

/**
 * Alias de compatibilidade com useActivities
 */
export const fetchActivities = getActivities;


