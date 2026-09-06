import * as XLSX from "xlsx";
import * as fflate from "fflate";
import { Activity } from "../types/activity.types";

/**
 * Filtros aplicados na tela repassados opcionalmente para exibição institucional no cabeçalho
 */
export interface ExportExcelFilterOptions {
  search?: string;
  statusFilter?: string;
  areaFilter?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Formata data no formato brasileiro DD/MM/AAAA para exibição limpa no Excel.
 * Aceita formatos ISO "YYYY-MM-DD" ou com timestamp ISO.
 */
function formatDateBR(dateStr?: string): string {
  if (!dateStr || dateStr === "-" || dateStr.trim() === "") return "-";
  const cleanDate = dateStr.split("T")[0].trim();
  const parts = cleanDate.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

/**
 * Tradução oficial de status operacional da atividade para apresentação limpa no Excel
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
 * Gera o XML de estilos do Excel (styles.xml) garantindo:
 * - Fontes calibradas (Título Branco 13pt, Subtítulo Azul 10pt, Meta/Rodapé Cinza 9pt, Cabeçalho Branco Negrito 10pt)
 * - Fundo Azul Escuro Industrial (#0B1F3A) no cabeçalho institucional e nos cabeçalhos da tabela
 * - Cores discretas de preenchimento para Status (Planejada, Em Andamento, Concluída, Cancelada)
 * - Cores discretas de preenchimento para Prioridade (Urgente, Alta, Média, Baixa)
 * - Bordas discretas (#E2E8F0) e quebra automática de texto (wrapText)
 */
function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="10"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="13"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="10"/><color rgb="FF0B1F3A"/><name val="Calibri"/><family val="2"/></font>
    <font><sz val="9"/><color rgb="FF475569"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="12">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0B1F3A"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFEDD5"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE2E8F0"/></left>
      <right style="thin"><color rgb="FFE2E8F0"/></right>
      <top style="thin"><color rgb="FFE2E8F0"/></top>
      <bottom style="thin"><color rgb="FFE2E8F0"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="15">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="8" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="9" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="10" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="11" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleMedium4"/>
</styleSheet>`;
}

/**
 * Constrói o pacote .xlsx completo injetando:
 * 1. Tabela Estruturada Oficial do Excel (TableStyleMedium9, nome TabelaAtividades, ref A6:Q{N})
 * 2. Congelamento da linha de cabeçalho da tabela (Row 6 congelada, A7 no topo ao rolar)
 * 3. Cabeçalho institucional profissional RSS3 (Título, subtítulo, dados de exportação, filtros aplicados)
 * 4. Estilos visuais discretos para Status e Prioridade
 * 5. Quebra de texto automática e bordas discretas
 */
function enhanceWorkbookWithStructuredTable(
  rawBuffer: Uint8Array,
  columns: string[],
  dataRows: (string | number)[][],
  tableStartRow: number,
  tableEndRow: number
): Uint8Array {
  try {
    const unzipped = fflate.unzipSync(rawBuffer);

    // 1. Dimensão da tabela (A6:Q{tableEndRow})
    const numCols = columns.length; // 17
    const colLetters = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q"];
    const lastColLetter = colLetters[numCols - 1] || "Q";
    const tableRef = `A${tableStartRow}:${lastColLetter}${tableEndRow}`;

    // 2. Colunas da tabela XML
    const tableColumnsXml = columns
      .map((col, idx) => {
        const escaped = col
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return `<tableColumn id="${idx + 1}" name="${escaped}"/>`;
      })
      .join("");

    // 3. XML da Tabela Estruturada Oficial do Excel
    const tableXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
      `id="1" name="TabelaAtividades" displayName="TabelaAtividades" ref="${tableRef}" totalsRowShown="0">` +
      `<autoFilter ref="${tableRef}"/>` +
      `<tableColumns count="${numCols}">${tableColumnsXml}</tableColumns>` +
      `<tableStyleInfo name="TableStyleMedium9" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>` +
      `</table>`;

    unzipped["xl/tables/table1.xml"] = fflate.strToU8(tableXml);

    // 4. Relacionamento na worksheet: xl/worksheets/_rels/sheet1.xml.rels
    const sheetRelsXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rIdTable1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/>` +
      `</Relationships>`;

    unzipped["xl/worksheets/_rels/sheet1.xml.rels"] = fflate.strToU8(sheetRelsXml);

    // 5. Injetar folha de estilos personalizada (styles.xml)
    unzipped["xl/styles.xml"] = fflate.strToU8(buildStylesXml());

    // 6. Atualizar xl/worksheets/sheet1.xml com estilos nas células, congelamento e tabela
    if (unzipped["xl/worksheets/sheet1.xml"]) {
      let sheetXml = fflate.strFromU8(unzipped["xl/worksheets/sheet1.xml"]);

      // Injetar congelamento de painel na linha 6 (cabeçalhos da tabela congelados)
      const freezeViewXml = `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${tableStartRow}" topLeftCell="A${tableStartRow + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${tableStartRow + 1}" sqref="A${tableStartRow + 1}"/></sheetView></sheetViews>`;
      sheetXml = sheetXml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, freezeViewXml);

      // Estilizar linhas institucionais
      sheetXml = sheetXml.replace(/(<c r="A1"[^>]*)(>)/, '$1 s="1"$2');
      sheetXml = sheetXml.replace(/(<c r="A2"[^>]*)(>)/, '$1 s="2"$2');
      sheetXml = sheetXml.replace(/(<c r="A3"[^>]*)(>)/, '$1 s="3"$2');
      sheetXml = sheetXml.replace(/(<c r="A4"[^>]*)(>)/, '$1 s="3"$2');

      // Estilizar rodapé
      const footerRow = tableEndRow + 2;
      const footerRegex = new RegExp(`(<c r="A${footerRow}"[^>]*)(>)`);
      sheetXml = sheetXml.replace(footerRegex, '$1 s="4"$2');

      // Estilizar cabeçalhos da tabela na linha tableStartRow (A6..Q6) -> s="5"
      for (const col of colLetters) {
        const hRegex = new RegExp(`(<c r="${col}${tableStartRow}"[^>]*)(>)`);
        sheetXml = sheetXml.replace(hRegex, '$1 s="5"$2');
      }

      // Estilizar Status (col C) e Prioridade (col D) nas linhas de dados da tabela
      dataRows.forEach((row, idx) => {
        const rowNum = tableStartRow + 1 + idx;
        const statusVal = String(row[2] || "");
        const priorityVal = String(row[3] || "");

        let statusStyle = 14;
        if (statusVal === "Planejada") statusStyle = 6;
        else if (statusVal === "Em Andamento") statusStyle = 7;
        else if (statusVal === "Concluída") statusStyle = 8;
        else if (statusVal === "Cancelada") statusStyle = 9;

        let priorityStyle = 14;
        if (priorityVal === "Urgente") priorityStyle = 10;
        else if (priorityVal === "Alta") priorityStyle = 11;
        else if (priorityVal === "Média") priorityStyle = 12;
        else if (priorityVal === "Baixa") priorityStyle = 13;

        const cStatusRegex = new RegExp(`(<c r="C${rowNum}"[^>]*)(>)`);
        sheetXml = sheetXml.replace(cStatusRegex, `$1 s="${statusStyle}"$2`);

        const cPrioRegex = new RegExp(`(<c r="D${rowNum}"[^>]*)(>)`);
        sheetXml = sheetXml.replace(cPrioRegex, `$1 s="${priorityStyle}"$2`);
      });

      // Remove tag autoFilter redundante se presente (a tabela gerencia o autoFilter)
      sheetXml = sheetXml.replace(/<autoFilter[^>]*\/>/g, "");

      // Insere tableParts antes do fechamento </worksheet>
      sheetXml = sheetXml.replace(
        "</worksheet>",
        `<tableParts count="1"><tablePart r:id="rIdTable1"/></tableParts></worksheet>`
      );
      unzipped["xl/worksheets/sheet1.xml"] = fflate.strToU8(sheetXml);
    }

    // 7. Registrar o ContentType da tabela em [Content_Types].xml
    if (unzipped["[Content_Types].xml"]) {
      let contentTypesXml = fflate.strFromU8(unzipped["[Content_Types].xml"]);
      if (!contentTypesXml.includes("/xl/tables/table1.xml")) {
        contentTypesXml = contentTypesXml.replace(
          "</Types>",
          `<Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/></Types>`
        );
        unzipped["[Content_Types].xml"] = fflate.strToU8(contentTypesXml);
      }
    }

    // 8. Compactar novamente com fflate
    return fflate.zipSync(unzipped);
  } catch (err) {
    console.warn("Aviso ao aplicar tabela estruturada e estilos no Excel, utilizando fallback:", err);
    return rawBuffer;
  }
}

/**
 * Dispara o download de um buffer no navegador como arquivo .xlsx
 */
function triggerBrowserDownload(buffer: Uint8Array, fileName: string): void {
  const blob = new Blob([buffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Formata descrição legível dos filtros ativos para o cabeçalho institucional
 */
function formatActiveFiltersDescription(filters?: ExportExcelFilterOptions): string {
  if (!filters) return "Nenhum (todas as frentes de trabalho)";

  const parts: string[] = [];

  if (filters.search && filters.search.trim()) {
    parts.push(`Busca: "${filters.search.trim()}"`);
  }
  if (filters.statusFilter && filters.statusFilter !== "todos") {
    parts.push(`Status: ${formatStatus(filters.statusFilter)}`);
  }
  if (filters.areaFilter && filters.areaFilter !== "todas") {
    parts.push(`Área: ${filters.areaFilter}`);
  }
  if (filters.startDate) {
    parts.push(`De: ${formatDateBR(filters.startDate)}`);
  }
  if (filters.endDate) {
    parts.push(`Até: ${formatDateBR(filters.endDate)}`);
  }

  return parts.length > 0 ? parts.join("  |  ") : "Nenhum (todas as frentes de trabalho)";
}

/**
 * Exporta a lista atual de atividades filtradas para uma planilha Excel (.xlsx) profissional corporativa,
 * contendo cabeçalho institucional RSS3, Tabela Estruturada oficial do Excel (TabelaAtividades),
 * diferenciação visual discreta de status e prioridade, congelamento de linha e rodapé.
 */
export function exportActivitiesToExcel(
  activities: Activity[],
  filterOptions?: ExportExcelFilterOptions
): boolean {
  if (!activities || activities.length === 0) {
    return false;
  }

  // 1. Mapeamento estrito das 17 colunas solicitadas da atividade
  const dataRows = activities.map((act) => {
    // Local / Equipamento consolidado
    const locationParts = [act.location?.local, act.location?.equipment]
      .filter((v) => Boolean(v && v.trim() && v !== "-"))
      .join(" / ");

    // Materiais planejados consolidados em linha única (ex: "Epóxi: 20 L; Primer: 10 L")
    const plannedMaterialsSummary = (act.plannedMaterials || [])
      .map((pm) => `${pm.materialName}: ${pm.quantity} ${pm.unit}`)
      .join("; ");

    const estimatedQty =
      act.serviceQuantity !== undefined && act.serviceQuantity !== null && !isNaN(Number(act.serviceQuantity))
        ? Number(act.serviceQuantity)
        : "-";

    return [
      act.orderNumber || "-",                               // 1. Nº da OS
      act.name || "-",                                      // 2. Nome da Atividade
      formatStatus(act.status),                             // 3. Status
      formatPriority(act.priority),                         // 4. Prioridade
      act.location?.area || "-",                            // 5. Área
      locationParts || "-",                                 // 6. Local / Equipamento
      act.assignedTo || "-",                                // 7. Responsável
      act.team || act.schedule?.teamName || "-",            // 8. Equipe
      act.originReference || "-",                           // 9. Origem / Referência
      formatDateBR(act.schedule?.plannedStartDate),        // 10. Data Início Planejada
      formatDateBR(act.schedule?.plannedEndDate),          // 11. Data Término Planejada
      estimatedQty,                                         // 12. Qtd. Estimada
      act.serviceUnit || "-",                               // 13. Unidade
      act.serviceType || "-",                               // 14. Tipo de Serviço
      plannedMaterialsSummary || "Nenhum planejado",        // 15. Materiais Planejados
      act.description || "-",                               // 16. Descrição
      act.observations || "-",                              // 17. Observações
    ];
  });

  // 2. Montar cabeçalho institucional (Linhas 1 a 5)
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const currentDateStr = `${day}/${month}/${year}`;
  const filtersText = formatActiveFiltersDescription(filterOptions);

  const headerRows = [
    ["RSS3 SOLUÇÕES INDUSTRIAIS"],
    ["Relatório de Atividades – Pintura"],
    [`Data da exportação: ${currentDateStr}  |  Total de atividades exportadas: ${activities.length}`],
    [`Filtros aplicados: ${filtersText}`],
    [], // Linha 5 em branco para respiração visual
  ];

  const columns = [
    "Nº da OS",
    "Nome da Atividade",
    "Status",
    "Prioridade",
    "Área",
    "Local / Equipamento",
    "Responsável",
    "Equipe",
    "Origem / Referência",
    "Data Início Planejada",
    "Data Término Planejada",
    "Qtd. Estimada",
    "Unidade",
    "Tipo de Serviço",
    "Materiais Planejados",
    "Descrição",
    "Observações",
  ];

  const tableStartRow = 6;
  const tableEndRow = tableStartRow + dataRows.length;

  const aoa: (string | number)[][] = [
    ...headerRows,
    columns,
    ...dataRows,
    [], // Linha em branco antes do rodapé
    ["Relatório gerado automaticamente pelo Sistema de Pintura RSS3."],
  ];

  // 3. Criar worksheet a partir da matriz completa
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  // 4. Mesclagens visuais institucionais (A1:Q1, A2:Q2, A3:Q3, A4:Q4, Rodapé)
  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 16 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 16 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 16 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 16 } },
    { s: { r: tableEndRow + 1, c: 0 }, e: { r: tableEndRow + 1, c: 16 } },
  ];

  // 5. Definir larguras adequadas e legíveis para as 17 colunas
  worksheet["!cols"] = [
    { wch: 14 }, // Nº da OS
    { wch: 36 }, // Nome da Atividade
    { wch: 16 }, // Status
    { wch: 14 }, // Prioridade
    { wch: 22 }, // Área
    { wch: 30 }, // Local / Equipamento
    { wch: 24 }, // Responsável
    { wch: 22 }, // Equipe
    { wch: 22 }, // Origem / Referência
    { wch: 22 }, // Data Início Planejada
    { wch: 22 }, // Data Término Planejada
    { wch: 15 }, // Qtd. Estimada
    { wch: 12 }, // Unidade
    { wch: 22 }, // Tipo de Serviço
    { wch: 42 }, // Materiais Planejados
    { wch: 40 }, // Descrição
    { wch: 34 }, // Observações
  ];

  // 6. Configurar alturas das linhas
  const rowHeights = [
    { hpt: 30 }, // 1: RSS3 SOLUÇÕES INDUSTRIAIS
    { hpt: 20 }, // 2: Relatório de Atividades – Pintura
    { hpt: 18 }, // 3: Data e total
    { hpt: 18 }, // 4: Filtros aplicados
    { hpt: 10 }, // 5: Espaçador
    { hpt: 26 }, // 6: Cabeçalhos da tabela
  ];
  for (let i = 0; i < dataRows.length; i++) {
    rowHeights.push({ hpt: 22 });
  }
  rowHeights.push({ hpt: 14 }); // Linha em branco
  rowHeights.push({ hpt: 18 }); // Rodapé
  worksheet["!rows"] = rowHeights;

  // 7. Criar workbook e anexar a aba "Atividades"
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Atividades");

  // 8. Gerar nome do arquivo no padrão oficial (atividades-pintura-rss3-DD-MM-AAAA.xlsx)
  const fileName = `atividades-pintura-rss3-${day}-${month}-${year}.xlsx`;

  // 9. Gerar buffer inicial com XLSX
  const rawArray = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  }) as Uint8Array;

  // 10. Injetar a Tabela Estruturada do Excel (TabelaAtividades), estilos institucionais e congelamento
  const finalBuffer = enhanceWorkbookWithStructuredTable(
    new Uint8Array(rawArray),
    columns,
    dataRows,
    tableStartRow,
    tableEndRow
  );

  // 11. Disparar download diretamente no navegador
  triggerBrowserDownload(finalBuffer, fileName);
  return true;
}
