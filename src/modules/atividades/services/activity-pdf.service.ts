import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Activity } from "../types/activity.types";

export interface GeneratePdfOptions {
  includePhotos: boolean;
}

/**
 * Formata datas ISO (YYYY-MM-DD ou YYYY-MM-DD HH:mm) para padrão brasileiro DD/MM/YYYY.
 */
function formatDateBR(dateStr?: string): string {
  if (!dateStr) return "-";
  const [datePart, timePart] = dateStr.split(" ");
  const parts = datePart.split("-");
  if (parts.length === 3) {
    const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
    return timePart ? `${formatted} às ${timePart}` : formatted;
  }
  return dateStr;
}

/**
 * Sanitiza o nome do arquivo para exportação segura.
 */
function sanitizeFileName(orderNumber: string): string {
  return orderNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Gera e realiza o download do relatório profissional da atividade em PDF.
 */
export async function generateActivityPdf(
  activity: Activity,
  options: GeneratePdfOptions
): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 15;
  const marginRight = 15;
  const contentWidth = pageWidth - marginLeft - marginRight;

  let currentY = 18;

  // ============================================================================
  // CABEÇALHO CORPORATIVO
  // ============================================================================
  // Barra de destaque superior verde esmeralda
  doc.setFillColor(16, 185, 129); // #10b981
  doc.rect(0, 0, pageWidth, 4, "F");

  // Identificação do Sistema
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // #0f172a
  doc.text("SISTEMA PINTURA INDUSTRIAL", marginLeft, currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // #64748b
  doc.text("Relatório Técnico Operacional de Atividade", marginLeft, currentY + 5);

  // Informações de Emissão e Status no topo direito
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`OS: ${activity.orderNumber}`, pageWidth - marginRight, currentY, { align: "right" });

  const statusLabel = activity.status.toUpperCase();
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  if (activity.status === "concluida") {
    doc.setTextColor(5, 150, 105);
  } else if (activity.status === "cancelada") {
    doc.setTextColor(225, 29, 72);
  } else {
    doc.setTextColor(37, 99, 235);
  }
  doc.text(`STATUS: ${statusLabel}`, pageWidth - marginRight, currentY + 5, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  const nowBR = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(`Emitido em: ${nowBR}`, pageWidth - marginRight, currentY + 9, { align: "right" });

  currentY += 15;

  // Linha divisória sutil
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setLineWidth(0.5);
  doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);

  currentY += 6;

  // Função auxiliar para títulos de seção
  const renderSectionHeader = (title: string, yPos: number): number => {
    doc.setFillColor(248, 250, 252); // #f8fafc
    doc.rect(marginLeft, yPos, contentWidth, 6, "F");

    doc.setFillColor(16, 185, 129); // Indicador verde lateral
    doc.rect(marginLeft, yPos, 2, 6, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(title.toUpperCase(), marginLeft + 5, yPos + 4.2);

    return yPos + 9;
  };

  // ============================================================================
  // SEÇÃO 1: IDENTIFICAÇÃO GERAL
  // ============================================================================
  currentY = renderSectionHeader("1. Identificação Geral da Atividade", currentY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Nome da Atividade:", marginLeft, currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(activity.name || "-", marginLeft + 35, currentY);

  currentY += 5;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Tipo de Serviço:", marginLeft, currentY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(activity.serviceType || "-", marginLeft + 35, currentY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Prioridade:", marginLeft + 100, currentY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text((activity.priority || "Média").toUpperCase(), marginLeft + 120, currentY);

  currentY += 5;

  if (activity.originReference) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("Origem / Ref.:", marginLeft, currentY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(activity.originReference, marginLeft + 35, currentY);
    currentY += 5;
  }

  if (activity.description) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("Descrição:", marginLeft, currentY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    const splitDesc = doc.splitTextToSize(activity.description, contentWidth - 35);
    doc.text(splitDesc, marginLeft + 35, currentY);
    currentY += splitDesc.length * 4 + 2;
  } else {
    currentY += 2;
  }

  // ============================================================================
  // SEÇÃO 2: LOCALIZAÇÃO
  // ============================================================================
  currentY = renderSectionHeader("2. Hierarquia e Localização Física", currentY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Área:", marginLeft, currentY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(activity.location.area || "-", marginLeft + 15, currentY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Local Específico:", marginLeft + 65, currentY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(activity.location.local || "-", marginLeft + 95, currentY);

  currentY += 5;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Equipamento:", marginLeft, currentY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(activity.location.equipment || "Não especificado", marginLeft + 25, currentY);

  currentY += 7;

  // ============================================================================
  // SEÇÃO 3: PLANEJAMENTO E RESPONSABILIDADE
  // ============================================================================
  currentY = renderSectionHeader("3. Cronograma e Responsabilidade Técnica", currentY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Início Planejado:", marginLeft, currentY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(formatDateBR(activity.schedule.plannedStartDate), marginLeft + 30, currentY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Término Planejado:", marginLeft + 80, currentY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(formatDateBR(activity.schedule.plannedEndDate), marginLeft + 115, currentY);

  currentY += 5;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Início Real:", marginLeft, currentY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(formatDateBR(activity.schedule.actualStartDate), marginLeft + 30, currentY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Término Real:", marginLeft + 80, currentY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(formatDateBR(activity.schedule.actualEndDate), marginLeft + 115, currentY);

  currentY += 5;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Equipe Operacional:", marginLeft, currentY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(activity.team || activity.schedule.teamName || "-", marginLeft + 35, currentY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Responsável:", marginLeft + 90, currentY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(activity.assignedTo || "-", marginLeft + 115, currentY);

  currentY += 7;

  // ============================================================================
  // SEÇÃO 4: EXECUÇÃO E QUANTITATIVO
  // ============================================================================
  currentY = renderSectionHeader("4. Execução Físico-Quantitativa", currentY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Progresso Físico:", marginLeft, currentY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129);
  doc.text(`${activity.progressPercentage}%`, marginLeft + 30, currentY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Volume de Serviço:", marginLeft + 70, currentY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  const qtyStr = activity.serviceQuantity !== undefined ? `${activity.serviceQuantity} ${activity.serviceUnit || "m²"}` : "-";
  doc.text(qtyStr, marginLeft + 105, currentY);

  currentY += 5;

  const tagsStr = activity.tags && activity.tags.length > 0 ? activity.tags.map((t) => t.code).join(", ") : "-";
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Tags / Identificadores:", marginLeft, currentY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(tagsStr, marginLeft + 40, currentY);

  currentY += 5;

  if (activity.observations) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("Observações:", marginLeft, currentY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    const splitObs = doc.splitTextToSize(activity.observations, contentWidth - 30);
    doc.text(splitObs, marginLeft + 30, currentY);
    currentY += splitObs.length * 4 + 2;
  } else {
    currentY += 3;
  }

  // ============================================================================
  // CONDICIONAL: CANCELAMENTO (quando aplicável)
  // ============================================================================
  if (activity.status === "cancelada" || activity.history.some((h) => h.action.toLowerCase().includes("cancelamento"))) {
    const cancelEntry = activity.history.find((h) => h.action.toLowerCase().includes("cancelamento"));
    currentY = renderSectionHeader("Cancelamento Operacional", currentY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(225, 29, 72);
    doc.text("Status:", marginLeft, currentY);
    doc.text("ATIVIDADE CANCELADA", marginLeft + 15, currentY);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("Data/Hora:", marginLeft + 80, currentY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(formatDateBR(cancelEntry?.timestamp || activity.updatedAt), marginLeft + 100, currentY);

    currentY += 5;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("Motivo / Justificativa:", marginLeft, currentY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    const reasonText = cancelEntry?.observation || cancelEntry?.oldValue || "Cancelamento operacional registrado no sistema";
    const splitReason = doc.splitTextToSize(reasonText, contentWidth - 40);
    doc.text(splitReason, marginLeft + 40, currentY);
    currentY += splitReason.length * 4 + 4;
  }

  // ============================================================================
  // CONDICIONAL: ARQUIVAMENTO (quando aplicável)
  // ============================================================================
  if (activity.archivedAt) {
    currentY = renderSectionHeader("Arquivamento da Atividade", currentY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Data do Arquivamento:", marginLeft, currentY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(formatDateBR(activity.archivedAt), marginLeft + 40, currentY);

    currentY += 5;

    if (activity.archiveReason) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105);
      doc.text("Motivo:", marginLeft, currentY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      const splitArch = doc.splitTextToSize(activity.archiveReason, contentWidth - 20);
      doc.text(splitArch, marginLeft + 20, currentY);
      currentY += splitArch.length * 4 + 2;
    } else {
      currentY += 2;
    }
  }

  // ============================================================================
  // SEÇÃO 5: MATERIAIS PLANEJADOS E CONSUMO REAL
  // ============================================================================
  currentY = renderSectionHeader("5. Relação de Materiais e Consumo Real", currentY);

  const materialsRows: string[][] = [];

  const planned = activity.plannedMaterials || [];
  const consumptions = activity.consumptions || [];

  if (planned.length === 0 && consumptions.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Nenhum material registrado para esta atividade.", marginLeft, currentY + 3);
    currentY += 8;
  } else {
    // Mesclar planejados e consumidos por nome
    const matMap = new Map<string, { planned: number; consumed: number; unit: string }>();

    planned.forEach((pm) => {
      matMap.set(pm.materialName, {
        planned: pm.quantity,
        consumed: 0,
        unit: pm.unit,
      });
    });

    consumptions.forEach((c) => {
      const existing = matMap.get(c.materialName);
      if (existing) {
        existing.consumed += c.quantity;
      } else {
        matMap.set(c.materialName, {
          planned: 0,
          consumed: c.quantity,
          unit: c.unit,
        });
      }
    });

    matMap.forEach((val, key) => {
      materialsRows.push([
        key,
        val.planned > 0 ? String(val.planned) : "-",
        val.consumed > 0 ? String(val.consumed) : "-",
        val.unit,
      ]);
    });

    autoTable(doc, {
      startY: currentY,
      margin: { left: marginLeft, right: marginRight },
      head: [["Material / Insumo", "Qtd. Planejada", "Consumo Real", "Unidade"]],
      body: materialsRows,
      theme: "plain",
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [51, 65, 85],
        fontStyle: "bold",
        fontSize: 8,
      },
      styles: {
        fontSize: 8,
        textColor: [15, 23, 42],
        cellPadding: 2,
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
    });

    // @ts-expect-error autoTable plugin attaches lastAutoTable
    currentY = doc.lastAutoTable.finalY + 8;
  }

  // ============================================================================
  // SEÇÃO 6: HISTÓRICO DE APONTAMENTOS & AUDITORIA
  // ============================================================================
  currentY = renderSectionHeader("6. Histórico de Apontamentos e Auditoria", currentY);

  const history = activity.history || [];

  if (history.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Histórico não disponível para esta atividade.", marginLeft, currentY + 3);
    currentY += 8;
  } else {
    const historyRows = history.map((h) => [
      formatDateBR(h.timestamp),
      h.userName || "Usuário",
      h.action || "-",
      h.field || "-",
      h.newValue ? `${h.oldValue || "-"} → ${h.newValue}` : h.oldValue || "-",
      h.observation || "-",
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: marginLeft, right: marginRight },
      head: [["Data/Hora", "Usuário", "Ação", "Campo", "Alteração", "Observação"]],
      body: historyRows,
      theme: "plain",
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [51, 65, 85],
        fontStyle: "bold",
        fontSize: 7.5,
      },
      styles: {
        fontSize: 7.5,
        textColor: [15, 23, 42],
        cellPadding: 2,
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
    });

    // @ts-expect-error autoTable plugin attaches lastAutoTable
    currentY = doc.lastAutoTable.finalY + 8;
  }

  // ============================================================================
  // SEÇÃO 7: REGISTRO FOTOGRÁFICO (quando selecionado)
  // ============================================================================
  if (options.includePhotos) {
    // Se a posição estiver próxima ao rodapé, adiciona uma nova página
    if (currentY > pageHeight - 40) {
      doc.addPage();
      currentY = 20;
    }

    currentY = renderSectionHeader("7. Registro Fotográfico de Campo", currentY);

    // Verificação de fotos reais disponíveis
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Não há registros fotográficos vinculados a esta atividade.", marginLeft, currentY + 3);
    currentY += 8;
  }

  // ============================================================================
  // NUMERAÇÃO DE PÁGINAS E RODAPÉ CONTÍNUO
  // ============================================================================
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Linha do rodapé
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(marginLeft, pageHeight - 12, pageWidth - marginRight, pageHeight - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    // Texto rodapé esquerdo
    doc.text(
      `Sistema Pintura Industrial — OS: ${activity.orderNumber}`,
      marginLeft,
      pageHeight - 7
    );

    // Texto rodapé central
    doc.text(`Gerado em: ${nowBR}`, pageWidth / 2, pageHeight - 7, { align: "center" });

    // Texto rodapé direito: Página X de Y
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginRight, pageHeight - 7, {
      align: "right",
    });
  }

  // Download automático do arquivo
  const cleanOrder = sanitizeFileName(activity.orderNumber);
  const fileName = `OS_${cleanOrder}_Relatorio_Atividade.pdf`;
  doc.save(fileName);
}
