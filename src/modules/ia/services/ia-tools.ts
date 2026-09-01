import { SupabaseClient } from "@supabase/supabase-js";
import { FunctionDeclaration, Type } from "@google/genai";
import { calculateStockStatus } from "@/modules/materiais/rules/material.rules";

/**
 * 1. DECLARAÇÕES DE TOOLS PARA O SDK DO GEMINI (@google/genai)
 */

export const IA_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "buscarAtividades",
    description:
      "Busca e lista ordens de serviço (OS) e atividades de pintura na planta. Permite múltiplos filtros combináveis (termo de busca, status, apenas atrasadas, responsável, área, datas). Use para responder sobre frentes de trabalho, progresso, prazos e atividades ativas.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        termoBusca: {
          type: Type.STRING,
          description: "Texto para buscar no nome da atividade, código ou descrição (ex: 'Tanque 02', 'Estrutura metálica').",
        },
        status: {
          type: Type.STRING,
          description: "Status da atividade: 'programada', 'planejada', 'em_andamento', 'pausada', 'concluida' ou 'cancelada'.",
        },
        apenasAtrasadas: {
          type: Type.BOOLEAN,
          description: "Se true, filtra apenas atividades cujo prazo planejado já venceu em relação a hoje e ainda não foram concluídas ou canceladas.",
        },
        responsavel: {
          type: Type.STRING,
          description: "Nome ou parte do nome do responsável pela atividade.",
        },
        area: {
          type: Type.STRING,
          description: "Nome da área ou setor da planta (ex: 'Área Norte', 'Tubulação').",
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
      "Obtém todos os detalhes técnicos, datas, equipe, área, materiais planejados e consumos reais apontados de uma Ordem de Serviço (OS) específica pelo número ou identificador (ex: 'OS-1001', 'OS 1002', '1002').",
    parameters: {
      type: Type.OBJECT,
      properties: {
        identificador: {
          type: Type.STRING,
          description: "Número da OS ou código da atividade (ex: 'OS-1001', 'OS-1002', ou UUID).",
        },
      },
      required: ["identificador"],
    },
  },
  {
    name: "consultarEstoqueMateriais",
    description:
      "Consulta o catálogo técnico e o saldo físico de tintas, primers, diluentes e insumos no almoxarifado. Permite filtrar por situação do estoque ('critico', 'atencao', 'adequado') ou buscar por nome/código.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        busca: {
          type: Type.STRING,
          description: "Nome, tipo ou código do material (ex: 'epóxi', 'primer', 'poliuretano', 'MAT-001').",
        },
        statusEstoque: {
          type: Type.STRING,
          description: "Situação do estoque: 'critico' (abaixo do estoque mínimo), 'atencao' (próximo do mínimo) ou 'adequado'.",
        },
        tipo: {
          type: Type.STRING,
          description: "Categoria do material (ex: 'Tinta', 'Primer', 'Verniz', 'Solvente').",
        },
        limite: {
          type: Type.INTEGER,
          description: "Limite de registros a retornar (padrão: 20).",
        },
      },
    },
  },
  {
    name: "obterResumoGeralPlanta",
    description:
      "Obtém um resumo executivo consolidado da operação da planta no dia de hoje: total de OS ativas, total de atrasos, OS a vencer em 24h, total de insumos em nível crítico e média geral de avanço da pintura.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        incluirDetalhamento: {
          type: Type.BOOLEAN,
          description: "Se true, inclui também a lista resumida dos principais alertas do dia.",
        },
      },
    },
  },
  {
    name: "consultarHistoricoAuditoria",
    description:
      "Consulta o registro de auditoria e linha do tempo de alterações, apontamentos e mudanças de status de uma atividade ou os registros recentes da planta.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        identificadorAtividade: {
          type: Type.STRING,
          description: "Número da OS ou ID da atividade para buscar o histórico específico (ex: 'OS-1001').",
        },
        limite: {
          type: Type.INTEGER,
          description: "Quantidade máxima de registros a retornar (padrão: 10).",
        },
      },
    },
  },
  {
    name: "consultarNotificacoesRecentes",
    description:
      "Consulta as notificações e alertas operacionais gerados pelo sistema (ocorrências de atividades, prazos e alertas de insumos críticos).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        apenasNaoLidas: {
          type: Type.BOOLEAN,
          description: "Se true, filtra apenas notificações não lidas.",
        },
        severidade: {
          type: Type.STRING,
          description: "Filtrar por severidade: 'urgente', 'alerta' ou 'info'.",
        },
        limite: {
          type: Type.INTEGER,
          description: "Quantidade máxima de notificações (padrão: 10).",
        },
      },
    },
  },
];

/**
 * 2. EXECUTORES DETERMINÍSTICOS DAS TOOLS (EXECUÇÃO SOB SUPABASE RLS DO USUÁRIO)
 */

export async function executeIaTool(
  name: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const todayISO = new Date().toISOString().split("T")[0];

  switch (name) {
    case "buscarAtividades": {
      const termo = typeof args.termoBusca === "string" ? args.termoBusca.trim() : "";
      const status = typeof args.status === "string" ? args.status.trim() : "";
      const apenasAtrasadas = Boolean(args.apenasAtrasadas);
      const responsavel = typeof args.responsavel === "string" ? args.responsavel.trim() : "";
      const area = typeof args.area === "string" ? args.area.trim() : "";
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

      if (apenasAtrasadas) {
        query = query
          .not("status", "in", '("concluida","cancelada")')
          .lt("planned_end_date", todayISO);
      }

      if (termo) {
        query = query.or(`order_number.ilike.%${termo}%,name.ilike.%${termo}%,description.ilike.%${termo}%`);
      }

      const { data, error } = await query
        .order("planned_end_date", { ascending: true })
        .limit(limite);

      if (error) {
        return { erro: `Falha ao buscar atividades: ${error.message}` };
      }

      let items = (data || []).map((row: any) => ({
        id: row.id,
        order_number: row.order_number,
        name: row.name,
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
      }));

      if (responsavel) {
        const respLower = responsavel.toLowerCase();
        items = items.filter((i) => i.responsible && i.responsible.toLowerCase().includes(respLower));
      }

      if (area) {
        const areaLower = area.toLowerCase();
        items = items.filter((i) => i.area && i.area.toLowerCase().includes(areaLower));
      }

      return {
        total_encontrado: items.length,
        atividades: items,
      };
    }

    case "obterDetalhesAtividade": {
      const rawIdentificador = typeof args.identificador === "string" ? args.identificador.trim() : "";
      if (!rawIdentificador) {
        return { erro: "O identificador da OS ou ID da atividade é obrigatório." };
      }

      // Limpa prefixos comuns se o usuário digitar "OS 1002" -> "OS-1002"
      const cleanIdentificador = rawIdentificador.replace(/^os\s+/i, "OS-");

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
            registered_at,
            materials (name, code),
            users (full_name)
          ),
          activity_photos (
            id,
            stage,
            photo_url,
            created_at
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
            registrado_em: c.registered_at,
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

    case "consultarEstoqueMateriais": {
      const busca = typeof args.busca === "string" ? args.busca.trim() : "";
      const statusEstoque = typeof args.statusEstoque === "string" ? args.statusEstoque.trim().toLowerCase() : "";
      const tipo = typeof args.tipo === "string" ? args.tipo.trim() : "";
      const limite = typeof args.limite === "number" ? Math.min(args.limite, 50) : 20;

      let query = supabase
        .from("materials")
        .select("id, code, name, type, manufacturer, color, unit, current_stock, minimum_stock, location, active")
        .eq("active", true);

      if (busca) {
        query = query.or(`code.ilike.%${busca}%,name.ilike.%${busca}%,type.ilike.%${busca}%`);
      }

      if (tipo) {
        query = query.ilike("type", `%${tipo}%`);
      }

      const { data, error } = await query
        .order("current_stock", { ascending: true })
        .limit(limite);

      if (error) {
        return { erro: `Falha ao consultar estoque de materiais: ${error.message}` };
      }

      let items = (data || []).map((m: any) => {
        const cur = Number(m.current_stock || 0);
        const min = Number(m.minimum_stock || 0);
        const situacao = calculateStockStatus(cur, min);
        return {
          id: m.id,
          code: m.code,
          name: m.name,
          type: m.type,
          manufacturer: m.manufacturer || null,
          color: m.color || null,
          unit: m.unit,
          current_stock: cur,
          minimum_stock: min,
          situacao_estoque: situacao,
          location: m.location || null,
        };
      });

      if (statusEstoque) {
        items = items.filter((i) => i.situacao_estoque === statusEstoque);
      }

      return {
        total_encontrado: items.length,
        materiais: items,
      };
    }

    case "obterResumoGeralPlanta": {
      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrowISO = tomorrowDate.toISOString().split("T")[0];

      const [actRes, matRes, notifRes] = await Promise.all([
        supabase
          .from("activities")
          .select("id, order_number, name, status, priority, progress_percentage, planned_end_date, areas (name)")
          .is("archived_at", null),
        supabase
          .from("materials")
          .select("id, code, name, current_stock, minimum_stock")
          .eq("active", true),
        supabase
          .from("notifications")
          .select("id, severity, title, message, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const allActivities = actRes.data || [];
      const allMaterials = matRes.data || [];
      const recentNotifications = notifRes.data || [];

      const activeActivities = allActivities.filter(
        (a: any) => a.status === "programada" || a.status === "em_andamento" || a.status === "planejada" || a.status === "pausada"
      );

      const delayedActivities = activeActivities.filter(
        (a: any) => a.planned_end_date < todayISO
      );

      const dueSoonActivities = activeActivities.filter(
        (a: any) => a.planned_end_date >= todayISO && a.planned_end_date <= tomorrowISO && Number(a.progress_percentage || 0) < 80
      );

      const criticalMaterials = allMaterials.filter(
        (m: any) => Number(m.current_stock || 0) < Number(m.minimum_stock || 0)
      );

      const progressSum = activeActivities.reduce((acc: number, curr: any) => acc + (Number(curr.progress_percentage) || 0), 0);
      const mediaProgresso = activeActivities.length > 0 ? Math.round(progressSum / activeActivities.length) : 0;

      return {
        data_referencia: todayISO,
        indicadores: {
          total_atividades_ativas: activeActivities.length,
          total_atividades_atrasadas: delayedActivities.length,
          total_vencendo_em_breve: dueSoonActivities.length,
          total_materiais_criticos: criticalMaterials.length,
          progresso_medio_ativo_percentual: mediaProgresso,
        },
        atividades_atrasadas_destaque: delayedActivities.slice(0, 5).map((a: any) => ({
          order_number: a.order_number,
          name: a.name,
          prazo: a.planned_end_date,
          progresso: a.progress_percentage,
          area: a.areas?.name || null,
        })),
        materiais_criticos_destaque: criticalMaterials.slice(0, 5).map((m: any) => ({
          code: m.code,
          name: m.name,
          saldo_atual: m.current_stock,
          estoque_minimo: m.minimum_stock,
        })),
        notificacoes_recentes: recentNotifications,
      };
    }

    case "consultarHistoricoAuditoria": {
      const orderNumberOuId = typeof args.identificadorAtividade === "string" ? args.identificadorAtividade.trim() : "";
      const limite = typeof args.limite === "number" ? Math.min(args.limite, 30) : 10;

      let activityId: string | null = null;

      if (orderNumberOuId) {
        const clean = orderNumberOuId.replace(/^os\s+/i, "OS-");
        const { data: act } = await supabase
          .from("activities")
          .select("id, order_number")
          .or(`order_number.ilike.%${clean}%,id.eq.${clean}`)
          .limit(1)
          .maybeSingle();

        if (act) {
          activityId = act.id;
        }
      }

      let query = supabase
        .from("activity_audit_logs")
        .select(`
          id,
          action,
          old_progress,
          new_progress,
          consumed_materials,
          observation,
          field,
          old_value,
          new_value,
          created_at,
          activities (order_number, name),
          users (full_name)
        `);

      if (activityId) {
        query = query.eq("activity_id", activityId);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(limite);

      if (error) {
        return { erro: `Falha ao consultar auditoria: ${error.message}` };
      }

      return {
        total_registros: (data || []).length,
        logs: (data || []).map((l: any) => ({
          id: l.id,
          acao: l.action,
          atividade: l.activities ? `${l.activities.order_number} - ${l.activities.name}` : null,
          usuario: l.users?.full_name || "Sistema",
          progresso_anterior: l.old_progress,
          novo_progresso: l.new_progress,
          materiais_consumidos: l.consumed_materials,
          observacao: l.observation,
          data_hora: l.created_at,
        })),
      };
    }

    case "consultarNotificacoesRecentes": {
      const apenasNaoLidas = Boolean(args.apenasNaoLidas);
      const severidade = typeof args.severidade === "string" ? args.severidade.trim() : "";
      const limite = typeof args.limite === "number" ? Math.min(args.limite, 30) : 10;

      let query = supabase
        .from("notifications")
        .select("id, title, message, severity, category, read, created_at, link_href");

      if (apenasNaoLidas) {
        query = query.eq("read", false);
      }

      if (severidade) {
        query = query.eq("severity", severidade);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(limite);

      if (error) {
        return { erro: `Falha ao consultar notificações: ${error.message}` };
      }

      return {
        total_encontrado: (data || []).length,
        notificacoes: data || [],
      };
    }

    default:
      return { erro: `Tool desconhecida: ${name}` };
  }
}
