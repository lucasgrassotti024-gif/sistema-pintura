import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Material } from "../types/material.types";

/**
 * Formata datas ISO para padrão brasileiro DD/MM/YYYY.
 */
function formatDateBR(dateStr?: string): string {
  if (!dateStr) return "-";
  const [datePart, timePart] = dateStr.split("T");
  const parts = (datePart || "").split("-");
  if (parts.length === 3) {
    const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
    return timePart ? `${formatted} às ${timePart.substring(0, 5)}` : formatted;
  }
  return dateStr;
}

/**
 * Sanitiza o nome do arquivo para exportação segura.
 */
function sanitizeFileName(code: string): string {
  return code.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Gera e realiza o download do relatório técnico profissional do material em PDF.
 */
export async function generateMaterialPdf(material: Material): Promise<void> {
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
  doc.text("SISTEMA DE PINTURA INDUSTRIAL", marginLeft, currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // #64748b
  doc.text("FICHA TÉCNICA E CADASTRO DE MATERIAL", marginLeft, currentY + 5);

  // Badge do Código do Material no canto superior direito
  doc.setFillColor(241, 245, 249); // #f1f5f9
  doc.roundedRect(pageWidth - marginRight - 55, currentY - 5, 55, 12, 2, 2, "F");

  doc.setFont("courier", "bold");
  doc.setFontSize(11);
  doc.setTextColor(5, 150, 105); // #059669
  doc.text(material.code, pageWidth - marginRight - 27.5, currentY + 2.5, { align: "center" });

  currentY += 14;

  // Linha divisória fina
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setLineWidth(0.4);
  doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);

  currentY += 8;

  // ============================================================================
  // TÍTULO DO MATERIAL E STATUS
  // ============================================================================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(material.name, marginLeft, currentY);

  currentY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Tipo / Família: ${material.type}`, marginLeft, currentY);

  // Status de Estoque
  const statusLabel =
    material.status === "adequado"
      ? "ESTOQUE ADEQUADO"
      : material.status === "atencao"
      ? "ESTOQUE EM ATENÇÃO"
      : "ESTOQUE CRÍTICO";

  const statusColor: [number, number, number] =
    material.status === "adequado"
      ? [16, 185, 129]
      : material.status === "atencao"
      ? [217, 119, 6]
      : [225, 29, 72];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...statusColor);
  doc.text(`● ${statusLabel}`, pageWidth - marginRight, currentY, { align: "right" });

  currentY += 8;

  // ============================================================================
  // TABELA 1: DADOS TÉCNICOS E CADASTRAIS
  // ============================================================================
  autoTable(doc, {
    startY: currentY,
    theme: "plain",
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { fontStyle: "bold", textColor: [100, 116, 139], cellWidth: 45 },
      1: { cellWidth: 45 },
      2: { fontStyle: "bold", textColor: [100, 116, 139], cellWidth: 45 },
      3: { cellWidth: 45 },
    },
    body: [
      [
        "Código do Material:",
        material.code,
        "Unidade de Medida:",
        material.unit,
      ],
      [
        "Fabricante:",
        material.manufacturer || "Não informado",
        "Cor / Padrão:",
        material.color || "Não informado",
      ],
      [
        "Localização Padrão:",
        material.location || "Não especificado",
        "Status de Catálogo:",
        material.active ? "Ativo" : "Inativo",
      ],
    ],
  });

  currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ============================================================================
  // TABELA 2: BALANÇO DE ESTOQUE
  // ============================================================================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Controle e Balanço de Estoque", marginLeft, currentY);

  currentY += 3;

  autoTable(doc, {
    startY: currentY,
    head: [["Parâmetro de Estoque", "Quantidade", "Unidade", "Situação"]],
    body: [
      [
        "Saldo Físico Atual",
        `${material.currentStock}`,
        material.unit,
        statusLabel,
      ],
      [
        "Estoque Mínimo (Ponto de Pedido)",
        `${material.minimumStock}`,
        material.unit,
        material.currentStock < material.minimumStock ? "Abaixo do Mínimo" : "Conforme",
      ],
    ],
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      textColor: [15, 23, 42],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ============================================================================
  // INFORMAÇÕES TÉCNICAS ADICIONAIS
  // ============================================================================
  if (material.technicalInfo) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Informações Técnicas & Rendimento", marginLeft, currentY);

    currentY += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    const splitText = doc.splitTextToSize(material.technicalInfo, contentWidth);
    doc.text(splitText, marginLeft, currentY);

    currentY += splitText.length * 4.5 + 8;
  }

  // ============================================================================
  // RODAPÉ CORPORATIVO
  // ============================================================================
  const dateStr = new Date().toLocaleString("pt-BR");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // #94a3b8

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, pageHeight - 12, pageWidth - marginRight, pageHeight - 12);

  doc.text(
    `Relatório emitido em ${dateStr} | Sistema de Pintura Industrial`,
    marginLeft,
    pageHeight - 7
  );
  doc.text(`Página 1 de 1`, pageWidth - marginRight, pageHeight - 7, { align: "right" });

  // Download do arquivo PDF
  const safeName = sanitizeFileName(material.code);
  doc.save(`Material_${safeName}_Ficha_Tecnica.pdf`);
}
