import { LocalOutboxQueueRecord } from "../../local-db.types";
import { MutationDispatcherResult } from "../sync-engine.types";
import { SistemaPinturaLocalDB } from "../../local-db";

/**
 * Interface que encapsula o cliente Supabase mínimo necessário para os dispatchers
 */
export interface SupabaseClientLike {
  rpc: (
    fnName: string,
    params?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: unknown }> | any;
  from: (table: string) => any;
  storage?: {
    from: (bucket: string) => {
      upload: (
        path: string,
        file: any,
        options?: { contentType?: string; upsert?: boolean }
      ) => Promise<{ data: any; error: any }>;
      remove: (paths: string[]) => Promise<{ data: any; error: any }>;
      createSignedUrls?: (
        paths: string[],
        expiresIn: number
      ) => Promise<{ data: any; error: any }>;
    };
  };
}

/**
 * Dispatcher para CREATE_ACTIVITY.
 * 
 * Invoca a RPC public.sync_create_activity no Supabase:
 * - Utiliza o UUID local da atividade como chave primária definitiva (p_activity_id).
 * - Envia idempotencyKey estável (p_idempotency_key).
 * - Mapeia tags e materiais planejados para JSONB.
 * - Atualiza o registro local no IndexedDB para syncStatus="synced" e localVersion=server_version.
 */
export async function dispatchCreateActivity(
  mutation: LocalOutboxQueueRecord,
  supabase: SupabaseClientLike,
  db: SistemaPinturaLocalDB
): Promise<MutationDispatcherResult> {
  const payload = mutation.payload || {};
  const activityId = mutation.entityId;
  const idempotencyKey = mutation.idempotencyKey;

  // Extração de dados com tipagem segura
  const orderNumber = String(payload.orderNumber || "").toUpperCase().trim();
  const name = String(payload.name || "").trim();
  const serviceType = payload.serviceType ? String(payload.serviceType) : "Pintura Geral";
  const description = String(payload.description || name || "").trim();
  const originReference = payload.originReference ? String(payload.originReference).trim() : null;

  // Localização (location: { area, local, equipment })
  const locObj = (payload.location as Record<string, unknown>) || {};
  const areaName = String(locObj.area || "Geral").trim();
  const localName = String(locObj.local || "Geral").trim();
  const equipmentName = locObj.equipment ? String(locObj.equipment).trim() : null;

  // Resolução de área e local no Supabase
  let areaId: string | null = null;
  const { data: areaData, error: areaErr } = await supabase
    .from("areas")
    .select("id")
    .eq("name", areaName)
    .maybeSingle();

  if (areaErr) {
    throw areaErr;
  }

  if (areaData) {
    areaId = (areaData as { id: string }).id;
  } else {
    const { data: newArea, error: newAreaErr } = await supabase
      .from("areas")
      .insert({
        name: areaName,
        code: areaName.substring(0, 3).toUpperCase(),
        active: true,
      })
      .select("id")
      .single();
    if (newAreaErr) throw newAreaErr;
    if (newArea) areaId = (newArea as { id: string }).id;
  }

  if (!areaId) {
    throw new Error("Não foi possível resolver ou criar a Área para cadastro da atividade.");
  }

  let locationId: string | null = null;
  const { data: locData, error: locErr } = await supabase
    .from("locations")
    .select("id")
    .eq("area_id", areaId)
    .eq("name", localName)
    .maybeSingle();

  if (locErr) {
    throw locErr;
  }

  if (locData) {
    locationId = (locData as { id: string }).id;
  } else {
    const { data: newLoc, error: newLocErr } = await supabase
      .from("locations")
      .insert({ area_id: areaId, name: localName })
      .select("id")
      .single();
    if (newLocErr) throw newLocErr;
    if (newLoc) locationId = (newLoc as { id: string }).id;
  }

  if (!locationId) {
    throw new Error("Não foi possível resolver ou criar o Local para cadastro da atividade.");
  }

  let equipmentId: string | null = null;
  let customLocationText: string | null = null;
  if (equipmentName && equipmentName !== "Não especificado") {
    const { data: eqData } = await supabase
      .from("equipments")
      .select("id")
      .eq("location_id", locationId)
      .eq("name", equipmentName)
      .maybeSingle();

    if (eqData) {
      equipmentId = (eqData as { id: string }).id;
    } else {
      customLocationText = equipmentName;
    }
  }

  let teamId: string | null = null;
  if (payload.team) {
    const { data: teamData } = await supabase
      .from("teams")
      .select("id")
      .eq("name", String(payload.team))
      .maybeSingle();
    if (teamData) teamId = (teamData as { id: string }).id;
  }

  const assignedUserId = payload.assignedUserId ? String(payload.assignedUserId) : null;
  const status = String(payload.status || "programada");
  const priority = String(payload.priority || "media");
  const serviceQuantity = payload.serviceQuantity ? Number(payload.serviceQuantity) : null;
  const serviceUnit = String(payload.serviceUnit || "m²");

  const scheduleObj = (payload.schedule as Record<string, unknown>) || {};
  const plannedStartDate = String(scheduleObj.plannedStartDate || new Date().toISOString().split("T")[0]);
  const plannedEndDate = String(scheduleObj.plannedEndDate || plannedStartDate);
  const observations = payload.observations ? String(payload.observations).trim() : null;

  // Tags
  const rawTags = (payload.tags as Array<Record<string, unknown>>) || [];
  const tagsJson = rawTags.map((t, idx) => ({
    tag_code: String(t.code || t.tag_code || "").toUpperCase().trim(),
    is_main: idx === 0,
  }));

  // Planned materials
  const rawMaterials = (payload.plannedMaterials as Array<Record<string, unknown>>) || [];
  const plannedMaterialsJson = rawMaterials.map((pm) => ({
    material_id: pm.materialId || pm.material_id || null,
    custom_material_name: String(pm.materialName || pm.custom_material_name || "Insumo").trim(),
    planned_quantity: Number(pm.quantity ?? pm.planned_quantity ?? 0),
    unit: String(pm.unit || "L").trim(),
    area_m2: pm.areaM2 !== undefined && pm.areaM2 !== null ? Number(pm.areaM2) : null,
    coats: pm.coats !== undefined && pm.coats !== null ? Number(pm.coats) : null,
    consumption_per_m2_per_coat:
      pm.consumptionPerM2PerCoat !== undefined && pm.consumptionPerM2PerCoat !== null
        ? Number(pm.consumptionPerM2PerCoat)
        : null,
    package_type: pm.packageType ? String(pm.packageType) : null,
    package_volume: pm.packageVolume !== undefined && pm.packageVolume !== null ? Number(pm.packageVolume) : null,
    packages_required: pm.packagesRequired !== undefined && pm.packagesRequired !== null ? Number(pm.packagesRequired) : null,
  }));

  // Invocação da RPC transacional
  const { data, error } = await supabase.rpc("sync_create_activity", {
    p_activity_id: activityId,
    p_order_number: orderNumber,
    p_name: name,
    p_service_type: serviceType,
    p_description: description,
    p_origin_reference: originReference,
    p_area_id: areaId,
    p_location_id: locationId,
    p_equipment_id: equipmentId,
    p_custom_location_text: customLocationText,
    p_status: status,
    p_priority: priority,
    p_assigned_user_id: assignedUserId,
    p_team_id: teamId,
    p_service_quantity: serviceQuantity,
    p_service_unit: serviceUnit,
    p_planned_start_date: plannedStartDate,
    p_planned_end_date: plannedEndDate,
    p_observations: observations,
    p_tags: tagsJson,
    p_planned_materials: plannedMaterialsJson,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    throw error;
  }

  const result = data as {
    success?: boolean;
    conflict?: boolean;
    idempotent?: boolean;
    code?: string;
    message?: string;
    server_version?: number;
    activity_id?: string;
  };

  // Se o servidor retornou conflito explícito em JSONB
  if (result.conflict) {
    throw {
      code: result.code || "CONFLICT",
      message: result.message || "Conflito na criação da atividade",
      details: result,
    };
  }

  const serverVersion = result.server_version || 1;

  // Reconciliação local no IndexedDB: atualiza atividade para synced e versão confirmada
  await db.transaction("rw", db.activities, async () => {
    const local = await db.activities.get(activityId);
    if (local) {
      await db.activities.put({
        ...local,
        syncStatus: "synced",
        localVersion: serverVersion,
        localUpdatedAt: new Date().toISOString(),
      });
    }
  });

  return {
    success: true,
    idempotent: Boolean(result.idempotent),
    newVersion: serverVersion,
    data: result,
  };
}
