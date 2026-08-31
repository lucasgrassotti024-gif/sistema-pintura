import { SupabaseClient } from "@supabase/supabase-js";
import {
  IaRouterResult,
  OperationalSnapshot,
  ActivitySnapshotItem,
  MaterialSnapshotItem,
  NotificationSnapshotItem,
} from "../types/ia.types";
import { calculateStockStatus } from "@/modules/materiais/rules/material.rules";

interface DbActivityRow {
  id: string;
  order_number: string;
  name: string;
  status: string;
  priority: string;
  progress_percentage: number;
  planned_start_date: string;
  planned_end_date: string;
  cancellation_reason?: string | null;
  areas?: { name: string } | null;
  locations?: { name: string } | null;
  equipments?: { name: string } | null;
  users?: { full_name: string } | null;
  teams?: { name: string } | null;
  activity_planned_materials?: Array<{
    custom_material_name: string;
    planned_quantity: number;
    unit: string;
    materials?: { name: string } | null;
  }> | null;
  activity_consumptions?: Array<{
    quantity: number;
    unit: string;
    materials?: { name: string } | null;
  }> | null;
}

interface DbMaterialRow {
  id: string;
  code: string;
  name: string;
  type: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  location?: string | null;
}

interface DbNotificationRow {
  severity: string;
  title: string;
  message: string;
  created_at: string;
}

/**
 * Context Builder Server-Side Seguro.
 *
 * Executa consultas restritas no Supabase utilizando o cliente autenticado do usuário (respeitando 100% o RLS),
 * montando um Snapshot Operacional compacto e estritamente relacionado à intenção classificada.
 */
export async function buildOperationalSnapshot(
  supabase: SupabaseClient,
  routing: IaRouterResult
): Promise<OperationalSnapshot> {
  const todayISO = new Date().toISOString().split("T")[0];
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowISO = tomorrowDate.toISOString().split("T")[0];

  // 1. Coleta de Metadados Resumidos da Planta (Contadores rápidos)
  const { data: countData } = await supabase
    .from("activities")
    .select("status, planned_end_date, progress_percentage")
    .is("archived_at", null);

  const activeActivities = countData || [];
  const totalActive = activeActivities.filter(
    (a) => a.status === "programada" || a.status === "em_andamento" || a.status === "planejada" || a.status === "pausada"
  ).length;

  const delayedCount = activeActivities.filter(
    (a) =>
      a.status !== "concluida" &&
      a.status !== "cancelada" &&
      a.planned_end_date < todayISO
  ).length;

  const dueSoonCount = activeActivities.filter(
    (a) =>
      a.status !== "concluida" &&
      a.status !== "cancelada" &&
      a.planned_end_date >= todayISO &&
      a.planned_end_date <= tomorrowISO &&
      Number(a.progress_percentage || 0) < 80
  ).length;

  const { data: matCountData } = await supabase
    .from("materials")
    .select("current_stock, minimum_stock")
    .eq("active", true);

  const criticalMaterialsCount = (matCountData || []).filter(
    (m) => Number(m.current_stock) < Number(m.minimum_stock)
  ).length;

  const baseSummary = {
    total_active_os: totalActive,
    delayed_os_count: delayedCount,
    due_soon_os_count: dueSoonCount,
    critical_materials_count: criticalMaterialsCount,
  };

  // ----------------------------------------------------------------------------
  // CASO 1: Consulta de Ordem de Serviço Específica
  // ----------------------------------------------------------------------------
  if (routing.intent === "atividade_especifica" && routing.orderNumber) {
    const { data: actData } = await supabase
      .from("activities")
      .select(`
        id,
        order_number,
        name,
        status,
        priority,
        progress_percentage,
        planned_start_date,
        planned_end_date,
        cancellation_reason,
        areas (name),
        locations (name),
        equipments (name),
        users!activities_assigned_user_id_fkey (full_name),
        teams (name),
        activity_planned_materials (
          custom_material_name,
          planned_quantity,
          unit,
          materials (name)
        ),
        activity_consumptions (
          quantity,
          unit,
          materials (name)
        )
      `)
      .ilike("order_number", `%${routing.orderNumber}%`)
      .limit(3);

    const activities: ActivitySnapshotItem[] = ((actData as unknown as DbActivityRow[]) || []).map((row) => ({
      id: row.id,
      order_number: row.order_number,
      name: row.name,
      status: row.status,
      priority: row.priority,
      progress_percentage: Number(row.progress_percentage || 0),
      planned_start_date: row.planned_start_date,
      planned_end_date: row.planned_end_date,
      area_name: row.areas?.name,
      location_name: row.locations?.name,
      equipment_name: row.equipments?.name,
      assigned_user_name: row.users?.full_name,
      team_name: row.teams?.name,
      cancellation_reason: row.cancellation_reason || undefined,
      planned_materials: (row.activity_planned_materials || []).map((pm) => ({
        name: pm.materials?.name || pm.custom_material_name,
        planned_qty: Number(pm.planned_quantity),
        unit: pm.unit,
      })),
      recent_consumptions: (row.activity_consumptions || []).map((c) => ({
        material_name: c.materials?.name || "Insumo",
        qty: Number(c.quantity),
        unit: c.unit,
      })),
    }));

    return {
      timestamp: todayISO,
      intent: "atividade_especifica",
      specific_target: routing.orderNumber,
      summary: baseSummary,
      activities,
      disclaimer: activities.length === 0 ? `A Ordem de Serviço ${routing.orderNumber} não foi encontrada no banco de dados.` : undefined,
    };
  }

  // ----------------------------------------------------------------------------
  // CASO 2: Atrasos Operacionais
  // ----------------------------------------------------------------------------
  if (routing.intent === "atrasos") {
    const { data: actData } = await supabase
      .from("activities")
      .select(`
        id,
        order_number,
        name,
        status,
        priority,
        progress_percentage,
        planned_start_date,
        planned_end_date,
        areas (name),
        users!activities_assigned_user_id_fkey (full_name),
        teams (name)
      `)
      .is("archived_at", null)
      .not("status", "in", '("concluida","cancelada")')
      .lt("planned_end_date", todayISO)
      .order("planned_end_date", { ascending: true })
      .limit(15);

    const activities: ActivitySnapshotItem[] = ((actData as unknown as DbActivityRow[]) || []).map((row) => ({
      id: row.id,
      order_number: row.order_number,
      name: row.name,
      status: row.status,
      priority: row.priority,
      progress_percentage: Number(row.progress_percentage || 0),
      planned_start_date: row.planned_start_date,
      planned_end_date: row.planned_end_date,
      area_name: row.areas?.name,
      assigned_user_name: row.users?.full_name,
      team_name: row.teams?.name,
    }));

    return {
      timestamp: todayISO,
      intent: "atrasos",
      summary: baseSummary,
      activities,
    };
  }

  // ----------------------------------------------------------------------------
  // CASO 3: Prazos Próximos / Cronograma da Semana
  // ----------------------------------------------------------------------------
  if (routing.intent === "prazos") {
    const { data: actData } = await supabase
      .from("activities")
      .select(`
        id,
        order_number,
        name,
        status,
        priority,
        progress_percentage,
        planned_start_date,
        planned_end_date,
        areas (name),
        users!activities_assigned_user_id_fkey (full_name),
        teams (name)
      `)
      .is("archived_at", null)
      .not("status", "in", '("concluida","cancelada")')
      .gte("planned_end_date", todayISO)
      .lte("planned_end_date", tomorrowISO)
      .order("planned_end_date", { ascending: true })
      .limit(15);

    const activities: ActivitySnapshotItem[] = ((actData as unknown as DbActivityRow[]) || []).map((row) => ({
      id: row.id,
      order_number: row.order_number,
      name: row.name,
      status: row.status,
      priority: row.priority,
      progress_percentage: Number(row.progress_percentage || 0),
      planned_start_date: row.planned_start_date,
      planned_end_date: row.planned_end_date,
      area_name: row.areas?.name,
      assigned_user_name: row.users?.full_name,
      team_name: row.teams?.name,
    }));

    return {
      timestamp: todayISO,
      intent: "prazos",
      summary: baseSummary,
      activities,
    };
  }

  // ----------------------------------------------------------------------------
  // CASO 4: Estoque e Insumos
  // ----------------------------------------------------------------------------
  if (routing.intent === "estoque" || routing.intent === "materiais") {
    const { data: matData } = await supabase
      .from("materials")
      .select("id, code, name, type, unit, current_stock, minimum_stock, location")
      .eq("active", true)
      .order("current_stock", { ascending: true })
      .limit(20);

    const materials: MaterialSnapshotItem[] = ((matData as unknown as DbMaterialRow[]) || []).map((m) => {
      const cur = Number(m.current_stock || 0);
      const min = Number(m.minimum_stock || 0);
      return {
        id: m.id,
        code: m.code,
        name: m.name,
        type: m.type,
        unit: m.unit,
        current_stock: cur,
        minimum_stock: min,
        status: calculateStockStatus(cur, min),
        location: m.location || undefined,
      };
    });

    return {
      timestamp: todayISO,
      intent: routing.intent,
      summary: baseSummary,
      materials,
    };
  }

  // ----------------------------------------------------------------------------
  // CASO 5: Riscos Operacionais (Cruzamento de Atraso + Estoque Crítico + Notificações)
  // ----------------------------------------------------------------------------
  if (routing.intent === "riscos_operacionais") {
    const { data: actData } = await supabase
      .from("activities")
      .select(`
        id,
        order_number,
        name,
        status,
        priority,
        progress_percentage,
        planned_start_date,
        planned_end_date,
        areas (name),
        users!activities_assigned_user_id_fkey (full_name)
      `)
      .is("archived_at", null)
      .not("status", "in", '("concluida","cancelada")')
      .or(`planned_end_date.lt.${todayISO},and(planned_end_date.lte.${tomorrowISO},progress_percentage.lt.80)`)
      .limit(10);

    const activities: ActivitySnapshotItem[] = ((actData as unknown as DbActivityRow[]) || []).map((row) => ({
      id: row.id,
      order_number: row.order_number,
      name: row.name,
      status: row.status,
      priority: row.priority,
      progress_percentage: Number(row.progress_percentage || 0),
      planned_start_date: row.planned_start_date,
      planned_end_date: row.planned_end_date,
      area_name: row.areas?.name,
      assigned_user_name: row.users?.full_name,
    }));

    const { data: matData } = await supabase
      .from("materials")
      .select("id, code, name, type, unit, current_stock, minimum_stock")
      .eq("active", true)
      .limit(20);

    const materials: MaterialSnapshotItem[] = ((matData as unknown as DbMaterialRow[]) || [])
      .filter((m) => Number(m.current_stock) <= Number(m.minimum_stock))
      .slice(0, 10)
      .map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        type: m.type,
        unit: m.unit,
        current_stock: Number(m.current_stock),
        minimum_stock: Number(m.minimum_stock),
        status: calculateStockStatus(Number(m.current_stock), Number(m.minimum_stock)),
      }));

    const { data: notifData } = await supabase
      .from("notifications")
      .select("severity, title, message, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    return {
      timestamp: todayISO,
      intent: "riscos_operacionais",
      summary: baseSummary,
      activities,
      materials,
      notifications: (notifData as DbNotificationRow[]) || [],
    };
  }

  // ----------------------------------------------------------------------------
  // CASO 6: Panorama Geral (Fallback Limitado)
  // ----------------------------------------------------------------------------
  const { data: actData } = await supabase
    .from("activities")
    .select(`
      id,
      order_number,
      name,
      status,
      priority,
      progress_percentage,
      planned_start_date,
      planned_end_date,
      areas (name),
      users!activities_assigned_user_id_fkey (full_name)
    `)
    .is("archived_at", null)
    .not("status", "in", '("concluida","cancelada")')
    .order("planned_end_date", { ascending: true })
    .limit(8);

  const activities: ActivitySnapshotItem[] = ((actData as unknown as DbActivityRow[]) || []).map((row) => ({
    id: row.id,
    order_number: row.order_number,
    name: row.name,
    status: row.status,
    priority: row.priority,
    progress_percentage: Number(row.progress_percentage || 0),
    planned_start_date: row.planned_start_date,
    planned_end_date: row.planned_end_date,
    area_name: row.areas?.name,
    assigned_user_name: row.users?.full_name,
  }));

  const { data: matData } = await supabase
    .from("materials")
    .select("id, code, name, type, unit, current_stock, minimum_stock")
    .eq("active", true)
    .order("current_stock", { ascending: true })
    .limit(6);

  const materials: MaterialSnapshotItem[] = ((matData as unknown as DbMaterialRow[]) || []).map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    type: m.type,
    unit: m.unit,
    current_stock: Number(m.current_stock),
    minimum_stock: Number(m.minimum_stock),
    status: calculateStockStatus(Number(m.current_stock), Number(m.minimum_stock)),
  }));

  return {
    timestamp: todayISO,
    intent: "panorama",
    summary: baseSummary,
    activities,
    materials,
  };
}
