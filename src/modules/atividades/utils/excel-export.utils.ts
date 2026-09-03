import * as XLSX from "xlsx";
import { Activity } from "../types/activity.types";

/**
 * Tradução de status operacional para apresentação limpa no Excel
 */
function formatStatus(status: string): string {
  const map: Record<string, string> = {
    programada: "Programada",
    planejada: "Planejada",
    em_andamento: "Em Andamento",
    pausada: "Pausada",
    concluida: "Concluída",
    cancelada: "Cancelada",
  };
  return map[status] || status;
}

/**
 * Tradução de prioridade
 */
function formatPriority(priority: string): string {
  const map: Record<string, string> = {
    baixa: "Baixa",
    media: "Média",
    alta: "Alta",
    urgente: "Urgente",
  };
  return map[priority] || priority;
}

/**
 * Exporta a lista atual de atividades filtradas para uma planilha Excel (.xlsx) profissional.
 */
export function exportActivitiesToExcel(activities: Activity[]): boolean {
  if (!activities || activities.length === 0) {
    return false;
  }

  // 1. Mapeamento das colunas da planilha operacional
  const rows = activities.map((act) => {
    // Local / Equipamento consolidado
    const locationParts = [act.location?.local, act.location?.equipment]
      .filter((v) => Boolean(v && v.trim() && v !== "-"))
      .join(" / ");

    // Materiais planejados consolidados em linha única (ex: "Epóxi: 10 L; Borracha Líquida: 5 L")
    const plannedSummary = (act.plannedMaterials || [])
      .map((pm) => `${pm.materialName}: ${pm.quantity} ${pm.unit}`)
      .join("; ");

    // Consumos realizados consolidados em linha única (agrupados por insumo)
    const consumptionSummary = (act.consumptions || [])
      .map((c) => `${c.materialName}: ${Number(c.quantity).toFixed(1)} ${c.unit}`)
      .join("; ");

    // Tags consolidadas
    const tagsSummary = (act.tags || []).map((t) => t.code).join(", ");

    return {
      "Nº da OS": act.orderNumber,
      "Nome da Atividade": act.name,
      "Status": formatStatus(act.status),
      "Prioridade": formatPriority(act.priority),
      "Área": act.location?.area || "-",
      "Local / Equipamento": locationParts || "-",
      "Responsável": act.assignedTo || "-",
      "Equipe": act.team || act.schedule?.teamName || "-",
      "Origem / Referência": act.originReference || "-",
      "Data Início Programada": act.schedule?.plannedStartDate || "-",
      "Data Término Programada": act.schedule?.plannedEndDate || "-",
      "Início Real": act.schedule?.actualStartDate || "-",
      "Conclusão Real": act.schedule?.actualEndDate || "-",
      "Progresso (%)": Number(act.progressPercentage) || 0,
      "Qtd. Estimada": act.serviceQuantity !== undefined && act.serviceQuantity !== null ? Number(act.serviceQuantity) : "-",
      "Unidade": act.serviceUnit || "-",
      "Tipo de Serviço": act.serviceType || "-",
      "Tags": tagsSummary || "-",
      "Materiais Planejados": plannedSummary || "Nenhum planejado",
      "Consumo Realizado": consumptionSummary || "Nenhum apontamento",
      "Descrição": act.description || "-",
      "Observações": act.observations || "-",
      "Data de Criação": act.createdAt || "-",
      "Última Atualização": act.updatedAt || "-",
    };
  });

  // 2. Criar worksheet a partir dos dados JSON
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // 3. Definir larguras adequadas e legíveis para cada coluna
  worksheet["!cols"] = [
    { wch: 14 }, // Nº da OS
    { wch: 34 }, // Nome da Atividade
    { wch: 16 }, // Status
    { wch: 14 }, // Prioridade
    { wch: 22 }, // Área
    { wch: 28 }, // Local / Equipamento
    { wch: 24 }, // Responsável
    { wch: 22 }, // Equipe
    { wch: 20 }, // Origem / Referência
    { wch: 16 }, // Início Programado
    { wch: 16 }, // Término Programado
    { wch: 14 }, // Início Real
    { wch: 14 }, // Conclusão Real
    { wch: 14 }, // Progresso (%)
    { wch: 14 }, // Qtd. Estimada
    { wch: 10 }, // Unidade
    { wch: 22 }, // Tipo de Serviço
    { wch: 18 }, // Tags
    { wch: 38 }, // Materiais Planejados
    { wch: 38 }, // Consumo Realizado
    { wch: 35 }, // Descrição
    { wch: 30 }, // Observações
    { wch: 15 }, // Data de Criação
    { wch: 15 }, // Última Atualização
  ];

  // 4. Ativar autofiltro em todas as colunas
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:X1");
  worksheet["!autofilter"] = { ref: XLSX.utils.encode_range(range) };

  // 5. Criar workbook e anexar a aba "Atividades"
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Atividades");

  // 6. Gerar nome profissional com a data da exportação (DD-MM-AAAA)
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const fileName = `atividades-pintura-rss3-${day}-${month}-${year}.xlsx`;

  // 7. Disparar download diretamente no navegador
  XLSX.writeFile(workbook, fileName);
  return true;
}
