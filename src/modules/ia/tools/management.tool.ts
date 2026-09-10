import { SupabaseClient } from "@supabase/supabase-js";
import { FunctionDeclaration, Type } from "@google/genai";
import { analyzeSharedStockDemand, classifyActivityOperationalRisk } from "../rules/operational-analytics.rules";

export const managementDeclarations: FunctionDeclaration[] = [
  {
    name: "obterResumoGeralPlanta",
    description:
      "Obtém um resumo executivo consolidado da operação da planta: total de OS ativas, total de atrasos, OS a vencer em 24h, insumos críticos e média de avanço da pintura.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        incluirDetalhamento: {
          type: Type.BOOLEAN,
          description: "Se true, inclui destaques de atividades atrasadas e materiais críticos.",
        },
      },
    },
  },
  {
    name: "verificarViabilidadeMateriais",
    description:
      "CRUZAMENTO MULTIDOMÍNIO OPERACIONAL: Cruza a programação de atividades de um período (ex: 'amanha', 'esta_semana') com o saldo atual do almoxarifado. Calcula deterministicamente o saldo projetado (Estoque Atual - Demanda Planejada do Período) e aponta se há risco de falta de tintas/insumos e quais OS serão afetadas.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        periodo: {
          type: Type.STRING,
          description: "Período para checagem: 'hoje', 'amanha' ou 'esta_semana'.",
        },
        dataEspecifica: {
          type: Type.STRING,
          description: "Data em formato YYYY-MM-DD quando período for específico.",
        },
      },
      required: ["periodo"],
    },
  },
];

export async function executeManagementTool(
  toolName: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const todayISO = new Date().toISOString().split("T")[0];

  switch (toolName) {
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
        (a: any) =>
          a.status === "programada" ||
          a.status === "em_andamento" ||
          a.status === "planejada" ||
          a.status === "pausada"
      );

      const delayedActivities = activeActivities.filter(
        (a: any) => a.planned_end_date < todayISO
      );

      const dueSoonActivities = activeActivities.filter(
        (a: any) =>
          a.planned_end_date >= todayISO &&
          a.planned_end_date <= tomorrowISO &&
          Number(a.progress_percentage || 0) < 80
      );

      const criticalMaterials = allMaterials.filter(
        (m: any) => Number(m.current_stock || 0) < Number(m.minimum_stock || 0)
      );

      const progressSum = activeActivities.reduce(
        (acc: number, curr: any) => acc + (Number(curr.progress_percentage) || 0),
        0
      );
      const mediaProgresso =
        activeActivities.length > 0 ? Math.round(progressSum / activeActivities.length) : 0;

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

    case "verificarViabilidadeMateriais": {
      const periodo = typeof args.periodo === "string" ? args.periodo.toLowerCase().trim() : "amanha";
      const now = new Date();
      let startDate = new Date();
      let endDate = new Date();

      if (periodo === "amanha" || periodo === "amanhã") {
        startDate.setDate(now.getDate() + 1);
        endDate.setDate(now.getDate() + 1);
      } else if (periodo === "esta_semana") {
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        startDate.setDate(now.getDate() + diffToMonday);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 4);
      } else if (typeof args.dataEspecifica === "string") {
        const p = new Date(args.dataEspecifica);
        if (!isNaN(p.getTime())) {
          startDate = p;
          endDate = p;
        }
      }

      const startISO = startDate.toISOString().split("T")[0];
      const endISO = endDate.toISOString().split("T")[0];

      // 1. Buscar atividades programadas no período
      const { data: activitiesData, error: actError } = await supabase
        .from("activities")
        .select(`
          id,
          order_number,
          name,
          status,
          priority,
          planned_start_date,
          planned_end_date,
          activity_planned_materials (
            id,
            material_id,
            custom_material_name,
            planned_quantity,
            unit,
            materials (id, code, name, current_stock, minimum_stock)
          )
        `)
        .is("archived_at", null)
        .not("status", "in", '("concluida","cancelada")')
        .lte("planned_start_date", endISO)
        .gte("planned_end_date", startISO);

      if (actError) {
        return { erro: `Falha ao consultar atividades do período: ${actError.message}` };
      }

      // 2. Buscar todos os materiais cadastrados no estoque para mapeamento completo
      const { data: materialsData, error: matError } = await supabase
        .from("materials")
        .select("id, code, name, current_stock, minimum_stock, unit")
        .eq("active", true);

      if (matError) {
        return { erro: `Falha ao consultar estoque de materiais: ${matError.message}` };
      }

      const stockMap = new Map<string, { id: string; code: string; name: string; current_stock: number; minimum_stock: number; unit: string }>();
      for (const m of materialsData || []) {
        stockMap.set(m.id, m);
        stockMap.set(m.name.toLowerCase().trim(), m);
      }

      // 3. Agregar demanda total de materiais planejados para o período
      interface MaterialDemand {
        materialId?: string;
        materialName: string;
        unit: string;
        demandaTotal: number;
        saldoAtualEstoque: number;
        atividadesAfetadas: Array<{ order_number: string; name: string; qtd_necessaria: number }>;
      }

      const demandMap = new Map<string, MaterialDemand>();
      const atividadesAnalisadas = (activitiesData || []).map((a: any) => ({
        order_number: a.order_number,
        name: a.name,
        materiais_planejados_count: (a.activity_planned_materials || []).length,
      }));

      for (const act of activitiesData || []) {
        for (const pm of (act.activity_planned_materials || []) as any[]) {
          const matObj = Array.isArray(pm.materials) ? pm.materials[0] : pm.materials;
          const matName = matObj?.name || pm.custom_material_name || "Insumo";
          const key = (pm.material_id || matName).toLowerCase().trim();
          const qty = Number(pm.planned_quantity || 0);

          const stockItem = pm.material_id
            ? stockMap.get(pm.material_id)
            : stockMap.get(matName.toLowerCase().trim());

          const currentStock = stockItem ? Number(stockItem.current_stock || 0) : 0;

          if (!demandMap.has(key)) {
            demandMap.set(key, {
              materialId: stockItem?.id || pm.material_id,
              materialName: matName,
              unit: pm.unit,
              demandaTotal: 0,
              saldoAtualEstoque: currentStock,
              atividadesAfetadas: [],
            });
          }

          const entry = demandMap.get(key)!;
          entry.demandaTotal += qty;
          entry.atividadesAfetadas.push({
            order_number: act.order_number,
            name: act.name,
            qtd_necessaria: qty,
          });
        }
      }

      // 4. Calcular Saldo Projetado e Déficits Concorrentes via regra determinística
      const analiseMateriais = Array.from(demandMap.values()).map((item) => {
        return analyzeSharedStockDemand(
          item.materialName,
          item.unit,
          item.saldoAtualEstoque,
          stockMap.get(item.materialId || item.materialName.toLowerCase().trim())?.minimum_stock || 0,
          item.atividadesAfetadas.map((a) => ({
            orderNumber: a.order_number,
            activityName: a.name,
            plannedQuantity: a.qtd_necessaria,
          })),
          item.materialId
        );
      });

      const materiaisCriticosComDeficit = analiseMateriais.filter((m) => !m.isViable);
      const viavelGlobal = materiaisCriticosComDeficit.length === 0;

      // 5. Mapear risco operacional por atividade no período
      const mapaDeficitPorMaterial = new Map<string, { materialName: string; deficit: number; unit: string }>();
      for (const m of materiaisCriticosComDeficit) {
        mapaDeficitPorMaterial.set(m.materialName.toLowerCase(), {
          materialName: m.materialName,
          deficit: m.deficit,
          unit: m.unit,
        });
      }

      const atividadesComAnaliseRisco = (activitiesData || []).map((act: any) => {
        const matDeficitsDaAtividade: Array<{ materialName: string; deficit: number; unit: string }> = [];
        for (const pm of act.activity_planned_materials || []) {
          const matObj = Array.isArray(pm.materials) ? pm.materials[0] : pm.materials;
          const name = (matObj?.name || pm.custom_material_name || "").toLowerCase();
          const def = mapaDeficitPorMaterial.get(name);
          if (def) {
            matDeficitsDaAtividade.push(def);
          }
        }

        return classifyActivityOperationalRisk({
          orderNumber: act.order_number,
          activityName: act.name,
          status: act.status,
          progressPercentage: Number(act.progress_percentage || 0),
          plannedEndDate: act.planned_end_date,
          todayISO,
          deficitMaterials: matDeficitsDaAtividade,
        });
      });

      return {
        periodo_analisado: {
          periodo,
          data_inicio: startISO,
          data_fim: endISO,
        },
        total_atividades_periodo: atividadesAnalisadas.length,
        situacao_geral: viavelGlobal
          ? "VIÁVEL: Estoque suficiente para todas as frentes planejadas no período."
          : "ALERTA DE DESABASTECIMENTO: Há materiais com saldo projetado concorrente insuficiente.",
        materiais_com_risco_deficit: materiaisCriticosComDeficit.map((m) => ({
          material: m.materialName,
          unidade: m.unit,
          estoque_atual: m.currentStock,
          demanda_total_concorrente: m.totalDemand,
          saldo_projetado: m.projectedBalance,
          deficit_calculado: m.deficit,
          frentes_afetadas: m.activities,
        })),
        atividades_em_risco_no_periodo: atividadesComAnaliseRisco.filter((a) => a.riskClassification === "critico"),
        todas_atividades_periodo: atividadesComAnaliseRisco,
      };
    }

    default:
      return { erro: `Tool de gestão desconhecida: ${toolName}` };
  }
}
