import { SupabaseClient } from "@supabase/supabase-js";
import { FunctionDeclaration, Type } from "@google/genai";

export const activitiesDeclarations: FunctionDeclaration[] = [
  {
    name: "buscarAtividades",
    description:
      "Busca e lista Ordens de Serviço (OS) e atividades de pintura industrial. Suporta filtros combináveis: termo de busca, status, apenas atrasadas, responsável, área e prioridade. Use para responder sobre frentes de trabalho ativas, progresso e atrasos.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        termoBusca: {
          type: Type.STRING,
          description: "Texto no nome da atividade, código ou descrição (ex: 'Tanque 02', 'Tubulação').",
        },
        status: {
          type: Type.STRING,
          description: "Filtrar por status: 'programada', 'planejada', 'em_andamento', 'pausada', 'concluida' ou 'cancelada'.",
        },
        apenasAtrasadas: {
          type: Type.BOOLEAN,
          description: "Se true, filtra apenas atividades cujo prazo planejado venceu em relação à data atual e não foram concluídas/canceladas.",
        },
        responsavel: {
          type: Type.STRING,
          description: "Nome ou parte do nome do responsável pela atividade.",
        },
        area: {
          type: Type.STRING,
          description: "Nome da área ou setor da planta.",
        },
        prioridade: {
          type: Type.STRING,
          description: "Prioridade da atividade: 'baixa', 'media', 'alta' ou 'urgente'.",
        },
        limite: {
          type: Type.INTEGER,
          description: "Quantidade máxima de registros a retornar (padrão: 15).",
        },
      },
    },
  },
  {
    name: "obterDetalhesAtividade",
    description:
      "Obtém todos os detalhes técnicos, datas, equipe, área, materiais planejados, consumos reais e status de uma Ordem de Serviço (OS) pelo identificador ou número (ex: 'OS-1001', 'OS 1025').",
    parameters: {
      type: Type.OBJECT,
      properties: {
        identificador: {
          type: Type.STRING,
          description: "Número da OS ou código da atividade (ex: 'OS-1001', 'OS-1025' ou UUID).",
        },
      },
      required: ["identificador"],
    },
  },
];

export async function executeActivitiesTool(
  toolName: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const todayISO = new Date().toISOString().split("T")[0];

  switch (toolName) {
    case "buscarAtividades": {
      const termo = typeof args.termoBusca === "string" ? args.termoBusca.trim() : "";
      const status = typeof args.status === "string" ? args.status.trim() : "";
      const apenasAtrasadas = Boolean(args.apenasAtrasadas);
      const responsavel = typeof args.responsavel === "string" ? args.responsavel.trim() : "";
      const area = typeof args.area === "string" ? args.area.trim() : "";
      const prioridade = typeof args.prioridade === "string" ? args.prioridade.trim() : "";
      const limite = typeof args.limite === "number" ? Math.min(args.limite, 50) : 15;

      let query = supabase
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
          actual_start_date,
          actual_end_date,
          assigned_user_id,
          areas (name),
          locations (name),
          equipments (name),
          users!activities_assigned_user_id_fkey (full_name),
          teams (name)
        `)
        .is("archived_at", null);

      if (status) {
        query = query.eq("status", status);
      }

      if (prioridade) {
        query = query.eq("priority", prioridade);
      }

      if (termo) {
        query = query.or(`order_number.ilike.%${termo}%,name.ilike.%${termo}%,description.ilike.%${termo}%`);
      }

      if (apenasAtrasadas) {
        query = query
          .lt("planned_end_date", todayISO)
          .not("status", "in", '("concluida","cancelada")');
      }

      const { data, error } = await query
        .order("planned_end_date", { ascending: true })
        .limit(limite);

      if (error) {
        return { erro: `Falha ao buscar atividades: ${error.message}` };
      }

      let items = (data || []).map((row: any) => {
        const isDelayed =
          row.status !== "concluida" &&
          row.status !== "cancelada" &&
          row.planned_end_date < todayISO;

        return {
          id: row.id,
          order_number: row.order_number,
          name: row.name,
          status: row.status,
          priority: row.priority,
          progress_percentage: Number(row.progress_percentage || 0),
          planned_start_date: row.planned_start_date,
          planned_end_date: row.planned_end_date,
          is_delayed: isDelayed,
          area: row.areas?.name || null,
          location: row.locations?.name || null,
          equipment: row.equipments?.name || null,
          responsible: row.users?.full_name || null,
          team: row.teams?.name || null,
        };
      });

      if (responsavel) {
        const respTerm = responsavel.toLowerCase();
        items = items.filter((i) => i.responsible?.toLowerCase().includes(respTerm));
      }

      if (area) {
        const areaTerm = area.toLowerCase();
        items = items.filter((i) => i.area?.toLowerCase().includes(areaTerm));
      }

      return {
        total_encontrado: items.length,
        atividades: items,
      };
    }

    case "obterDetalhesAtividade": {
      const rawIdentificador = typeof args.identificador === "string" ? args.identificador.trim() : "";
      if (!rawIdentificador) {
        return { erro: "Identificador da atividade obrigatório não informado." };
      }

      const cleanIdentificador = rawIdentificador.replace(/^os\s+/i, "OS-").trim();

      const { data, error } = await supabase
        .from("activities")
        .select(`
          id,
          order_number,
          name,
          description,
          status,
          priority,
          progress_percentage,
          planned_start_date,
          planned_end_date,
          actual_start_date,
          actual_end_date,
          service_quantity,
          service_unit,
          cancellation_reason,
          observations,
          areas (name),
          locations (name),
          equipments (name),
          users!activities_assigned_user_id_fkey (full_name),
          teams (name),
          activity_planned_materials (
            id,
            custom_material_name,
            planned_quantity,
            unit,
            materials (name, code)
          ),
          activity_consumptions (
            id,
            quantity,
            unit,
            created_at,
            materials (name, code),
            users (full_name)
          ),
          activity_photos (
            stage
          )
        `)
        .or(`order_number.ilike.%${cleanIdentificador}%,id.eq.${cleanIdentificador}`)
        .limit(1)
        .maybeSingle();

      if (error) {
        return { erro: `Falha ao obter detalhes da atividade: ${error.message}` };
      }

      if (!data) {
        return {
          encontrada: false,
          mensagem: `Nenhuma atividade encontrada com o identificador '${rawIdentificador}'.`,
        };
      }

      const row: any = data;
      return {
        encontrada: true,
        atividade: {
          id: row.id,
          order_number: row.order_number,
          name: row.name,
          description: row.description,
          status: row.status,
          priority: row.priority,
          progress_percentage: Number(row.progress_percentage || 0),
          planned_start_date: row.planned_start_date,
          planned_end_date: row.planned_end_date,
          is_delayed: row.status !== "concluida" && row.status !== "cancelada" && row.planned_end_date < todayISO,
          area: row.areas?.name || null,
          location: row.locations?.name || null,
          equipment: row.equipments?.name || null,
          responsible: row.users?.full_name || null,
          team: row.teams?.name || null,
          service_quantity: row.service_quantity,
          service_unit: row.service_unit,
          cancellation_reason: row.cancellation_reason || null,
          observations: row.observations || null,
          materiais_planejados: (row.activity_planned_materials || []).map((pm: any) => ({
            material: pm.materials?.name || pm.custom_material_name,
            codigo: pm.materials?.code || null,
            quantidade_planejada: Number(pm.planned_quantity),
            unidade: pm.unit,
          })),
          consumos_reais: (row.activity_consumptions || []).map((c: any) => ({
            material: c.materials?.name || "Insumo",
            codigo: c.materials?.code || null,
            quantidade_consumida: Number(c.quantity),
            unidade: c.unit,
            registrado_em: c.created_at,
            registrado_por: c.users?.full_name || null,
          })),
          fotos_registradas_por_etapa: {
            antes: (row.activity_photos || []).filter((p: any) => p.stage === "antes").length,
            durante: (row.activity_photos || []).filter((p: any) => p.stage === "durante").length,
            depois: (row.activity_photos || []).filter((p: any) => p.stage === "depois").length,
            inspecao: (row.activity_photos || []).filter((p: any) => p.stage === "inspecao").length,
            total_fotos: (row.activity_photos || []).length,
          },
        },
      };
    }

    default:
      return { erro: `Tool de atividades desconhecida: ${toolName}` };
  }
}
