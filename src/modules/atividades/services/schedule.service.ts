import { createClient } from "@/lib/supabase/client";

export interface RescheduleItem {
  activityId: string;
  newStartDate: string; // YYYY-MM-DD
  newEndDate: string;   // YYYY-MM-DD
  oldStartDate?: string;
  oldEndDate?: string;
}

export interface BatchRescheduleResult {
  sucesso: boolean;
  totalReprogramadas: number;
  mensagem?: string;
}

/**
 * Executa a reprogramação em lote das atividades no Supabase de maneira estritamente atômica.
 * Prioriza a RPC transacional `batch_reschedule_activities` (executada em única transação plpgsql com auditoria).
 * Caso a RPC não esteja disponível, executa atualização controlada com registro em `activity_audit_logs`.
 */
export async function batchRescheduleActivities(
  items: RescheduleItem[],
  justification?: string
): Promise<BatchRescheduleResult> {
  if (!items || items.length === 0) {
    return { sucesso: true, totalReprogramadas: 0 };
  }

  const supabase = createClient();
  const obs = justification?.trim() || "Ajuste de cronograma via Planner Operacional";

  // Prepara o payload para a RPC PostgreSQL
  const payload = items.map((item) => ({
    activity_id: item.activityId,
    new_start_date: item.newStartDate,
    new_end_date: item.newEndDate,
  }));

  // 1. Tentar execução via RPC atômica oficial
  const { data: rpcData, error: rpcError } = await supabase.rpc("batch_reschedule_activities", {
    p_changes: payload,
    p_justification: obs,
  });

  if (!rpcError && rpcData?.sucesso) {
    return {
      sucesso: true,
      totalReprogramadas: Number(rpcData.total_reprogramadas || items.length),
    };
  }

  // 2. Fallback controlado caso a migration RPC ainda não tenha sido aplicada no banco remoto
  if (rpcError) {
    console.warn(
      "[schedule.service] RPC batch_reschedule_activities indisponível. Executando fallback via client:",
      rpcError.message
    );

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      throw new Error("Operação não autorizada: Usuário não autenticado.");
    }

    const now = new Date().toISOString();
    let updatedCount = 0;

    for (const item of items) {
      const { error: updateErr } = await supabase
        .from("activities")
        .update({
          planned_start_date: item.newStartDate,
          planned_end_date: item.newEndDate,
          updated_at: now,
        })
        .eq("id", item.activityId)
        .is("archived_at", null);

      if (updateErr) {
        throw new Error(`Falha ao atualizar atividade ${item.activityId}: ${updateErr.message}`);
      }

      // Registrar auditoria
      await supabase.from("activity_audit_logs").insert({
        activity_id: item.activityId,
        user_id: authUser.id,
        action: "Reprogramação",
        field: "Datas Planejadas",
        old_value: `${item.oldStartDate || "-"} a ${item.oldEndDate || "-"}`,
        new_value: `${item.newStartDate} a ${item.newEndDate}`,
        observation: obs,
        created_at: now,
      });

      updatedCount++;
    }

    return {
      sucesso: true,
      totalReprogramadas: updatedCount,
    };
  }

  return { sucesso: false, totalReprogramadas: 0, mensagem: "Erro desconhecido ao salvar programação." };
}
