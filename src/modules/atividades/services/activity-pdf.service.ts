import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Activity } from "../types/activity.types";

export interface GeneratePdfOptions {
  includePhotos?: boolean;
}

/**
 * Formata datas ISO (YYYY-MM-DD ou YYYY-MM-DD HH:mm) para padrão brasileiro DD/MM/YYYY.
 */
function formatDateBR(dateStr?: string): string {
  if (!dateStr || dateStr === "-" || dateStr.trim() === "") return "-";
  const [datePart, timePart] = dateStr.split(" ");
  const cleanDate = (datePart || "").split("T")[0].trim();
  const parts = cleanDate.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
    return timePart ? `${formatted} às ${timePart}` : formatted;
  }
  return dateStr;
}

/**
 * Tradução oficial de status operacional da atividade
 */
function formatStatus(status: string): string {
  const map: Record<string, string> = {
    planejada: "Planejada",
    programada: "Programada",
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
 * Cores discretas para os badges de Status
 */
function getStatusBadgeColors(status: string): {
  bg: [number, number, number];
  text: [number, number, number];
  border: [number, number, number];
} {
  switch (status) {
    case "planejada":
    case "programada":
      return { bg: [254, 243, 199], text: [180, 83, 9], border: [253, 230, 138] }; // Amarelo discreto (#FEF3C7)
    case "em_andamento":
      return { bg: [219, 234, 254], text: [29, 78, 216], border: [191, 219, 254] }; // Azul discreto (#DBEAFE)
    case "concluida":
      return { bg: [209, 250, 229], text: [4, 120, 87], border: [167, 243, 208] }; // Verde discreto (#D1FAE5)
    case "cancelada":
      return { bg: [254, 226, 226], text: [185, 28, 28], border: [254, 202, 202] }; // Vermelho discreto (#FEE2E2)
    default:
      return { bg: [241, 245, 249], text: [71, 85, 105], border: [226, 232, 240] };
  }
}

/**
 * Cores discretas para os badges de Prioridade
 */
function getPriorityBadgeColors(priority: string): {
  bg: [number, number, number];
  text: [number, number, number];
  border: [number, number, number];
} {
  switch (priority) {
    case "urgente":
      return { bg: [254, 226, 226], text: [185, 28, 28], border: [254, 202, 202] }; // Vermelho discreto
    case "alta":
      return { bg: [255, 237, 213], text: [194, 65, 12], border: [254, 215, 170] }; // Laranja discreto (#FFEDD5)
    case "media":
      return { bg: [254, 243, 199], text: [180, 83, 9], border: [253, 230, 138] }; // Amarelo discreto
    case "baixa":
      return { bg: [241, 245, 249], text: [71, 85, 105], border: [226, 232, 240] }; // Cinza/azul discreto
    default:
      return { bg: [241, 245, 249], text: [71, 85, 105], border: [226, 232, 240] };
  }
}

/**
 * Sanitiza o nome do arquivo para exportação segura.
 */
function sanitizeFileName(orderNumber: string): string {
  return orderNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Renderiza o conteúdo completo de uma atividade individual em um documento jsPDF.
 * Garante que a atividade comece em uma nova página (exceto na primeira página limpa)
 * e compartilha 100% da identidade visual corporativa RSS3.
 */
function renderActivityContent(
  doc: jsPDF,
  activity: Activity,
  pageStartInfo: { activityStartPage: number; isFirstActivity: boolean }
): { startPage: number; endPage: number } {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 14;
  const marginRight = 14;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const marginBottom = 16;

  // Se não for a primeira atividade, adiciona uma nova página obrigatória
  if (!pageStartInfo.isFirstActivity) {
    doc.addPage();
  }

  const actStartPage = doc.getNumberOfPages();
  let currentY = 0;

  // Helper para checar necessidade de quebra de página
  const checkPageBreak = (neededHeight: number): boolean => {
    if (currentY + neededHeight > pageHeight - marginBottom) {
      doc.addPage();
      currentY = 16;
      return true;
    }
    return false;
  };

  // Helper para títulos de seção com barra lateral azul/laranja institucional
  const renderSectionHeader = (title: string): void => {
    checkPageBreak(12);

    doc.setFillColor(241, 245, 249); // #f1f5f9
    doc.roundedRect(marginLeft, currentY, contentWidth, 6.5, 1, 1, "F");

    // Acento lateral: Azul escuro (#0B1F3A) + Laranja (#F97316)
    doc.setFillColor(11, 31, 58);
    doc.rect(marginLeft, currentY, 2.5, 6.5, "F");

    doc.setFillColor(249, 115, 22);
    doc.rect(marginLeft + 2.5, currentY, 1.2, 6.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(11, 31, 58);
    doc.text(title.toUpperCase(), marginLeft + 6.5, currentY + 4.5);

    currentY += 9.5;
  };

  // Helper para renderizar Cards de Informação estruturados
  const renderInfoCard = (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    value: string
  ): void => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), x + 3.5, y + 4.2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const valText = doc.splitTextToSize(value || "-", w - 7);
    doc.text(valText[0] || "-", x + 3.5, y + 9);
  };

  // Helper para renderizar badges de status e prioridade
  const renderBadge = (
    x: number,
    y: number,
    text: string,
    colors: { bg: [number, number, number]; text: [number, number, number]; border: [number, number, number] }
  ): number => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    const textWidth = doc.getTextWidth(text);
    const badgeW = textWidth + 8;
    const badgeH = 5.5;

    doc.setFillColor(colors.bg[0], colors.bg[1], colors.bg[2]);
    doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, badgeW, badgeH, 1, 1, "FD");

    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    doc.text(text, x + 4, y + 3.9);

    return badgeW;
  };

  // ============================================================================
  // 1. CABEÇALHO INSTITUCIONAL RSS3
  // ============================================================================
  const headerHeight = 24;
  doc.setFillColor(11, 31, 58); // Azul escuro #0B1F3A
  doc.rect(0, 0, pageWidth, headerHeight, "F");

  // Linha de acento laranja RSS3 inferior
  doc.setFillColor(249, 115, 22); // #F97316
  doc.rect(0, headerHeight - 1.2, pageWidth, 1.2, "F");

  // Logo / Tag "R3" estilizado
  doc.setFillColor(249, 115, 22);
  doc.roundedRect(marginLeft, 4.5, 10, 10, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("R3", marginLeft + 2.5, 11.2);

  // Nome institucional e sistema
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("RSS3 SOLUÇÕES INDUSTRIAIS", marginLeft + 13, 9.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("SISTEMA DE PINTURA INDUSTRIAL  •  FICHA OPERACIONAL", marginLeft + 13, 14);

  // Número da OS e Emissão à direita
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(activity.orderNumber || "OS-N/A", pageWidth - marginRight, 9.5, { align: "right" });

  const nowBR = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Emissão: ${nowBR}`, pageWidth - marginRight, 14, { align: "right" });

  currentY = headerHeight + 5;

  // ============================================================================
  // 2. IDENTIFICAÇÃO DA ATIVIDADE (CARD HERO)
  // ============================================================================
  const heroH = 26;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginLeft, currentY, contentWidth, heroH, 2, 2, "FD");

  // Barra lateral azul destaque
  doc.setFillColor(37, 99, 235); // #2563EB
  doc.rect(marginLeft, currentY, 2.5, heroH, "F");

  // OS número pequeno em destaque
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(37, 99, 235);
  doc.text((activity.orderNumber || "").toUpperCase(), marginLeft + 6, currentY + 6);

  // Nome da Atividade grande
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);

  // Badges de Status e Prioridade alinhados no lado direito do Card Hero
  const statusColors = getStatusBadgeColors(activity.status);
  const priorityColors = getPriorityBadgeColors(activity.priority);

  const statusText = formatStatus(activity.status).toUpperCase();
  const priorityText = `PRIORIDADE ${formatPriority(activity.priority).toUpperCase()}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const statusW = doc.getTextWidth(statusText) + 8;
  const priorityW = doc.getTextWidth(priorityText) + 8;
  const totalBadgesW = statusW + 3 + priorityW;

  const badgeX = pageWidth - marginRight - totalBadgesW - 4;
  const badgeY = currentY + (heroH - 5.5) / 2;

  renderBadge(badgeX, badgeY, statusText, statusColors);
  renderBadge(badgeX + statusW + 3, badgeY, priorityText, priorityColors);

  // Nome da Atividade com quebra de linha ajustada ao espaço livre
  const maxNameWidth = badgeX - (marginLeft + 6) - 4;
  const nameLines = doc.splitTextToSize(activity.name, maxNameWidth);
  doc.text(nameLines.slice(0, 2), marginLeft + 6, currentY + 12.5);

  currentY += heroH + 6;

  // ============================================================================
  // 3. DADOS PRINCIPAIS (GRADE DE CARDS)
  // ============================================================================
  renderSectionHeader("1. Dados Principais da Ordem de Serviço");

  const cardW = (contentWidth - 4) / 2;
  const cardH = 12.5;

  const locationParts = [activity.location?.local, activity.location?.equipment]
    .filter((v) => Boolean(v && v.trim() && v !== "-"))
    .join(" / ");

  const qtyStr =
    activity.serviceQuantity !== undefined &&
    activity.serviceQuantity !== null &&
    !isNaN(Number(activity.serviceQuantity))
      ? `${activity.serviceQuantity} ${activity.serviceUnit || ""}`.trim()
      : "-";

  renderInfoCard(marginLeft, currentY, cardW, cardH, "Área", activity.location?.area || "-");
  renderInfoCard(marginLeft + cardW + 4, currentY, cardW, cardH, "Local / Equipamento", locationParts || "-");
  currentY += cardH + 3;

  renderInfoCard(marginLeft, currentY, cardW, cardH, "Responsável", activity.assignedTo || "-");
  renderInfoCard(
    marginLeft + cardW + 4,
    currentY,
    cardW,
    cardH,
    "Equipe Operacional",
    activity.team || activity.schedule?.teamName || "-"
  );
  currentY += cardH + 3;

  renderInfoCard(marginLeft, currentY, cardW, cardH, "Origem / Referência", activity.originReference || "-");
  renderInfoCard(
    marginLeft + cardW + 4,
    currentY,
    cardW,
    cardH,
    "Tipo de Serviço / Quantidade",
    `${activity.serviceType || "-"} (${qtyStr})`
  );
  currentY += cardH + 5;

  // ============================================================================
  // 4. CRONOGRAMA OPERACIONAL
  // ============================================================================
  renderSectionHeader("2. Cronograma Operacional");

  const cronoCardW = (contentWidth - 9) / 4;
  const cronoCardH = 13.5;

  renderInfoCard(
    marginLeft,
    currentY,
    cronoCardW,
    cronoCardH,
    "Início Planejado",
    formatDateBR(activity.schedule?.plannedStartDate)
  );
  renderInfoCard(
    marginLeft + cronoCardW + 3,
    currentY,
    cronoCardW,
    cronoCardH,
    "Término Planejado",
    formatDateBR(activity.schedule?.plannedEndDate)
  );
  renderInfoCard(
    marginLeft + (cronoCardW + 3) * 2,
    currentY,
    cronoCardW,
    cronoCardH,
    "Início Real",
    formatDateBR(activity.schedule?.actualStartDate)
  );
  renderInfoCard(
    marginLeft + (cronoCardW + 3) * 3,
    currentY,
    cronoCardW,
    cronoCardH,
    "Conclusão Real",
    formatDateBR(activity.schedule?.actualEndDate)
  );

  currentY += cronoCardH + 5;

  // ============================================================================
  // 5. MATERIAIS PLANEJADOS
  // ============================================================================
  renderSectionHeader("3. Materiais Planejados");

  const planned = activity.plannedMaterials || [];
  if (planned.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginLeft, currentY, contentWidth, 9, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Nenhum material planejado cadastrado para esta atividade.", marginLeft + 4, currentY + 5.5);
    currentY += 13;
  } else {
    const tableBody = planned.map((pm, idx) => [
      String(idx + 1).padStart(2, "0"),
      pm.materialName || "-",
      pm.quantity !== undefined ? String(pm.quantity) : "-",
      pm.unit || "-",
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: marginLeft, right: marginRight },
      head: [["Item", "Material / Insumo", "Qtd. Planejada", "Unidade"]],
      body: tableBody,
      theme: "striped",
      headStyles: {
        fillColor: [11, 31, 58], // Azul escuro #0B1F3A
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.8,
        halign: "left",
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      styles: {
        fontSize: 7.8,
        textColor: [15, 23, 42],
        cellPadding: 2.5,
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 28, halign: "right" },
        3: { cellWidth: 22, halign: "center" },
      },
    });

    // @ts-expect-error autoTable plugin attaches lastAutoTable
    currentY = doc.lastAutoTable.finalY + 5;
  }

  // ============================================================================
  // 6. DESCRIÇÃO DA ATIVIDADE
  // ============================================================================
  renderSectionHeader("4. Descrição da Atividade");

  const descText =
    activity.description && activity.description.trim()
      ? activity.description.trim()
      : "Sem descrição cadastrada.";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  const descLines = doc.splitTextToSize(descText, contentWidth - 8);
  const descBoxH = Math.max(12, descLines.length * 4.2 + 6);

  checkPageBreak(descBoxH + 4);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginLeft, currentY, contentWidth, descBoxH, 1.5, 1.5, "FD");

  doc.setTextColor(30, 41, 59);
  doc.text(descLines, marginLeft + 4, currentY + 5.2);

  currentY += descBoxH + 5;

  // ============================================================================
  // 7. OBSERVAÇÕES
  // ============================================================================
  renderSectionHeader("5. Observações");

  const obsText =
    activity.observations && activity.observations.trim()
      ? activity.observations.trim()
      : "Sem observações cadastradas.";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  const obsLines = doc.splitTextToSize(obsText, contentWidth - 8);
  const obsBoxH = Math.max(10, obsLines.length * 4.2 + 5.5);

  checkPageBreak(obsBoxH + 4);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginLeft, currentY, contentWidth, obsBoxH, 1.5, 1.5, "FD");

  doc.setTextColor(30, 41, 59);
  doc.text(obsLines, marginLeft + 4, currentY + 5.2);

  currentY += obsBoxH + 5;

  // ============================================================================
  // 8. HISTÓRICO DA ATIVIDADE (AUDITORIA OPERACIONAL COMPACTA)
  // ============================================================================
  const history = activity.history || [];
  if (history.length > 0) {
    renderSectionHeader("6. Histórico Operacional e Auditoria");

    const historyBody = history.map((h) => [
      formatDateBR(h.timestamp),
      h.userName || "Sistema",
      h.action || "-",
      h.observation || h.newValue || "-",
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: marginLeft, right: marginRight },
      head: [["Data/Hora", "Responsável", "Ação", "Observação / Detalhe"]],
      body: historyBody,
      theme: "striped",
      headStyles: {
        fillColor: [11, 31, 58],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.2,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      styles: {
        fontSize: 7.2,
        textColor: [15, 23, 42],
        cellPadding: 2,
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 32 },
        2: { cellWidth: 35 },
        3: { cellWidth: "auto" },
      },
    });

    // @ts-expect-error autoTable plugin attaches lastAutoTable
    currentY = doc.lastAutoTable.finalY + 5;
  }

  const actEndPage = doc.getNumberOfPages();
  return { startPage: actStartPage, endPage: actEndPage };
}

/**
 * Aplica o rodapé institucional contínuo em todas as páginas do documento com paginação global "Página X de Y".
 */
function applyDocumentFooter(
  doc: jsPDF,
  pageActivityMap?: Map<number, string>
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 14;
  const marginRight = 14;
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Linha superior do rodapé: cinza sutil
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.4);
    doc.line(marginLeft, pageHeight - 11, pageWidth - marginRight, pageHeight - 11);

    // Detalhe laranja à esquerda
    doc.setFillColor(249, 115, 22); // #F97316
    doc.rect(marginLeft, pageHeight - 11.2, 18, 0.8, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139); // slate-500

    // Texto rodapé esquerdo: inclui número da OS se disponível no mapeamento de página
    const orderNum = pageActivityMap?.get(i);
    const osSuffix = orderNum ? `  •  OS: ${orderNum}` : "";

    doc.text(
      `RSS3 SOLUÇÕES INDUSTRIAIS  |  Sistema de Pintura${osSuffix}`,
      marginLeft,
      pageHeight - 6.5
    );

    // Texto rodapé direito: Paginação Global Página X de Y
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginRight, pageHeight - 6.5, {
      align: "right",
    });
  }
}

/**
 * Gera e realiza o download do relatório profissional corporativo de uma atividade individual em PDF
 * com a identidade visual da RSS3 Soluções Industriais.
 */
export async function generateActivityPdf(
  activity: Activity,
  _options?: GeneratePdfOptions
): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageActivityMap = new Map<number, string>();
  const pageInfo = renderActivityContent(doc, activity, {
    activityStartPage: 1,
    isFirstActivity: true,
  });

  for (let p = pageInfo.startPage; p <= pageInfo.endPage; p++) {
    pageActivityMap.set(p, activity.orderNumber);
  }

  applyDocumentFooter(doc, pageActivityMap);

  // Download automático com nome oficial individual
  const cleanOrder = sanitizeFileName(activity.orderNumber);
  const fileName = `OS_${cleanOrder}_Relatorio_Atividade.pdf`;
  doc.save(fileName);
}

/**
 * Gera e realiza o download de um ÚNICO arquivo PDF contendo todas as atividades selecionadas.
 * Cada atividade inicia obrigatoriamente em uma nova página, reutilizando 100% do layout
 * da ficha completa RSS3 e mantendo paginação global unificada (Página X de Y).
 */
export async function generateActivitiesPdf(
  activities: Activity[],
  _options?: GeneratePdfOptions
): Promise<boolean> {
  if (!activities || activities.length === 0) {
    return false;
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageActivityMap = new Map<number, string>();

  // Renderiza sequencialmente cada atividade com quebra de página garantida
  activities.forEach((activity, index) => {
    const isFirstActivity = index === 0;
    const pageInfo = renderActivityContent(doc, activity, {
      activityStartPage: doc.getNumberOfPages(),
      isFirstActivity,
    });

    for (let p = pageInfo.startPage; p <= pageInfo.endPage; p++) {
      pageActivityMap.set(p, activity.orderNumber);
    }
  });

  // Aplica paginação global e rodapé contínuo em todas as páginas
  applyDocumentFooter(doc, pageActivityMap);

  // Nome do arquivo consolidado oficial: atividades-pintura-rss3-DD-MM-AAAA.pdf
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const fileName = `atividades-pintura-rss3-${day}-${month}-${year}.pdf`;

  doc.save(fileName);
  return true;
}
