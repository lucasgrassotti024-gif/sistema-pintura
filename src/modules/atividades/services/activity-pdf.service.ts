import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Activity, ActivityPhotoItem } from "../types/activity.types";
import { getActivityPhotos } from "./activity.service";
import { RSS3_LOGO_BASE64 } from "../constants/rss3-logo.constant";

export interface GeneratePdfOptions {
  includePhotos?: boolean;
}

interface LoadedPdfImage {
  dataUrl: string;
  width: number;
  height: number;
  format: "JPEG" | "PNG" | "WEBP";
  filename: string;
}

/**
 * Converte de forma segura e eficiente uma URL de foto em imagem Base64/DataURL para o jsPDF.
 * Possui proteções contra:
 * - URL expirada ou inválida
 * - Erro de rede / CORS
 * - Imagens excessivamente grandes (redimensiona no canvas se ultrapassar 1200px para economizar memória e tamanho do PDF)
 * - Retorna null em caso de falha para NÃO quebrar a geração do PDF.
 */
async function loadPdfImageSafe(photo: ActivityPhotoItem): Promise<LoadedPdfImage | null> {
  if (!photo.signedUrl) {
    console.warn(`[loadPdfImageSafe] Foto "${photo.originalFilename}" sem signedUrl disponível.`);
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const response = await fetch(photo.signedUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[loadPdfImageSafe] Resposta HTTP ${response.status} ao baixar foto "${photo.originalFilename}".`);
      return null;
    }

    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) {
      console.warn(`[loadPdfImageSafe] Tipo MIME não suportado para "${photo.originalFilename}": ${blob.type}`);
      return null;
    }

    // 1. Converter o Blob diretamente em DataURL via FileReader
    const rawDataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });

    if (!rawDataUrl) {
      console.warn(`[loadPdfImageSafe] Falha ao converter blob em DataURL para "${photo.originalFilename}".`);
      return null;
    }

    // 2. Determinar dimensões reais e realizar conversão/redimensionamento seguro
    return await new Promise<LoadedPdfImage | null>((resolve) => {
      const img = new Image();

      img.onload = () => {
        const naturalW = img.naturalWidth || img.width || 800;
        const naturalH = img.naturalHeight || img.height || 600;

        const isWebP = blob.type.toLowerCase().includes("webp") || photo.originalFilename.toLowerCase().endsWith(".webp");
        const maxDim = 1200;
        const needsResize = naturalW > maxDim || naturalH > maxDim;

        if (isWebP || needsResize) {
          try {
            let w = naturalW;
            let h = naturalH;

            if (needsResize) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }

            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");

            if (ctx) {
              ctx.drawImage(img, 0, 0, w, h);
              const convertedDataUrl = canvas.toDataURL("image/jpeg", 0.85);

              resolve({
                dataUrl: convertedDataUrl,
                width: w,
                height: h,
                format: "JPEG",
                filename: photo.originalFilename,
              });
              return;
            }
          } catch (canvasErr) {
            console.warn(`[loadPdfImageSafe] Exceção no canvas para "${photo.originalFilename}", utilizando fallback DataURL direto:`, canvasErr);
          }
        }

        const detectedFormat: "JPEG" | "PNG" | "WEBP" = blob.type.includes("png")
          ? "PNG"
          : blob.type.includes("webp")
          ? "WEBP"
          : "JPEG";

        resolve({
          dataUrl: rawDataUrl,
          width: naturalW,
          height: naturalH,
          format: detectedFormat,
          filename: photo.originalFilename,
        });
      };

      img.onerror = (e) => {
        console.warn(`[loadPdfImageSafe] Falha ao decodificar imagem "${photo.originalFilename}":`, e);
        resolve({
          dataUrl: rawDataUrl,
          width: 800,
          height: 600,
          format: "JPEG",
          filename: photo.originalFilename,
        });
      };

      img.src = rawDataUrl;
    });
  } catch (err) {
    console.warn(`[loadPdfImageSafe] Erro geral ao processar foto "${photo.originalFilename}":`, err);
    return null;
  }
}

/**
 * Formata datas ISO (YYYY-MM-DD ou YYYY-MM-DD HH:mm) para padrão brasileiro DD/MM/YYYY [HH:mm].
 */
function formatDateBR(dateStr?: string, includeTime = true): string {
  if (!dateStr || dateStr === "-" || dateStr.trim() === "") return "-";
  const [datePart, timePart] = dateStr.split(" ");
  const cleanDate = (datePart || "").split("T")[0].trim();
  const parts = cleanDate.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
    if (includeTime && timePart) {
      return `${formatted} ${timePart.slice(0, 5)}`;
    }
    return formatted;
  }
  return dateStr;
}

/**
 * Retorna data atual no formato DD/MM/YYYY
 */
function getTodayFormattedBR(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Sanitiza o nome do arquivo para exportação segura.
 */
function sanitizeFileName(orderNumber: string): string {
  return orderNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
}

interface PhotoLoadState {
  hasAttempted: boolean;
  totalFound: number;
  loadedCount: number;
  failedCount: number;
}

/**
 * Desenha uma célula de tabela industrial oficial RSS3 com rótulo em negrito e valor legível.
 */
function drawGridCell(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  options?: {
    drawRightBorder?: boolean;
    drawBottomBorder?: boolean;
    maxLines?: number;
  }
): void {
  const drawRight = options?.drawRightBorder ?? true;
  const drawBottom = options?.drawBottomBorder ?? true;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);

  // Bordas da célula
  if (drawRight) {
    doc.line(x + w, y, x + w, y + h);
  }
  if (drawBottom) {
    doc.line(x, y + h, x + w, y + h);
  }

  // Label (Caixa alta, negrito discreto, estilo documento técnico)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(20, 24, 33);
  doc.text(label.toUpperCase(), x + 2, y + 3.8);

  // Valor
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(15, 23, 42);

  const maxW = w - 4;
  const lines = doc.splitTextToSize(value || "-", maxW);
  const maxLines = options?.maxLines || 2;
  const displayLines = lines.slice(0, maxLines);

  let textY = y + 7.5;
  for (let i = 0; i < displayLines.length; i++) {
    doc.text(displayLines[i], x + 2, textY);
    textY += 3.4;
  }
}

/**
 * Desenha o cabeçalho oficial do documento RSS3 na página especificada.
 */
function drawOfficialHeader(
  doc: jsPDF,
  orderNumber: string,
  pageStr: string,
  isContinuation = false
): void {
  const x = 10;
  const y = 10;
  const totalW = 190;
  const headerH = 22;

  // Linhas divisórias do cabeçalho
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);

  // Linha inferior do cabeçalho
  doc.line(x, y + headerH, x + totalW, y + headerH);

  // Coluna 1: Logo RSS3 (largura 50mm)
  const col1W = 50;
  doc.line(x + col1W, y, x + col1W, y + headerH);

  try {
    // Renderiza a imagem do logo oficial RSS3
    doc.addImage(RSS3_LOGO_BASE64, "PNG", x + 2, y + 1.8, 46, 18.4);
  } catch (err) {
    console.warn("[drawOfficialHeader] Falha ao renderizar logo base64, usando fallback:", err);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(11, 31, 58);
    doc.text("RSS3", x + 15, y + 13);
  }

  // Coluna 2: Título centralizado (largura 92mm)
  const col2W = 92;
  const col2X = x + col1W;
  doc.line(col2X + col2W, y, col2X + col2W, y + headerH);

  const titleCenterX = col2X + col2W / 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  const mainTitle = isContinuation
    ? "RELATÓRIO DE ATIVIDADE — CONTINUAÇÃO"
    : "RELATÓRIO DE ATIVIDADE";
  doc.text(mainTitle, titleCenterX, y + 9.5, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text("PINTURA INDUSTRIAL", titleCenterX, y + 16, { align: "center" });

  // Coluna 3: Metadados OS / DATA / PÁGINA (largura 48mm)
  const col3W = 48;
  const col3X = col2X + col2W;
  const rowH = headerH / 3; // ~7.33mm

  // Linhas horizontais dos metadados
  doc.setLineWidth(0.3);
  doc.line(col3X, y + rowH, col3X + col3W, y + rowH);
  doc.line(col3X, y + rowH * 2, col3X + col3W, y + rowH * 2);

  // Linha 1: Nº DA OS
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(0, 0, 0);
  doc.text("Nº DA OS:", col3X + 2, y + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(orderNumber || "-", col3X + col3W - 2, y + 5, { align: "right" });

  // Linha 2: DATA
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.text("DATA:", col3X + 2, y + rowH + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(getTodayFormattedBR(), col3X + col3W - 2, y + rowH + 5, { align: "right" });

  // Linha 3: PÁGINA
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.text("PÁGINA:", col3X + 2, y + rowH * 2 + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(pageStr, col3X + col3W - 2, y + rowH * 2 + 5, { align: "right" });
}

/**
 * Desenha o bloco oficial de assinaturas no rodapé da página final (3 colunas iguais).
 */
function drawSignaturesFooter(doc: jsPDF, yStart: number): void {
  const x = 10;
  const totalW = 190;
  const totalH = 287 - yStart; // Preenche até a margem inferior (287)
  const colW = totalW / 3; // ~63.33mm

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);

  // Linha divisória horizontal superior
  doc.line(x, yStart, x + totalW, yStart);

  // Linhas verticais entre as 3 colunas
  doc.line(x + colW, yStart, x + colW, yStart + totalH);
  doc.line(x + colW * 2, yStart, x + colW * 2, yStart + totalH);

  const titles = [
    "ASSINATURA DO EXECUTANTE",
    "ASSINATURA DO RESPONSÁVEL",
    "ASSINATURA DO CLIENTE / FISCAL",
  ];

  for (let c = 0; c < 3; c++) {
    const colX = x + c * colW;
    const centerX = colX + colW / 2;

    // Linha de assinatura
    const lineY = yStart + 11;
    doc.setLineWidth(0.3);
    doc.line(colX + 5, lineY, colX + colW - 5, lineY);

    // Título da coluna
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(0, 0, 0);
    doc.text(titles[c], centerX, lineY + 3.8, { align: "center" });

    // NOME:
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.text("NOME:", colX + 4, yStart + 20.5);
    doc.setLineWidth(0.25);
    doc.line(colX + 15, yStart + 21, colX + colW - 4, yStart + 21);

    // DATA:
    doc.text("DATA:", colX + 4, yStart + 26);
    doc.line(colX + 15, yStart + 26.5, colX + 24, yStart + 26.5);
    doc.text("/", colX + 24.5, yStart + 26);
    doc.line(colX + 26.5, yStart + 26.5, colX + 35.5, yStart + 26.5);
    doc.text("/", colX + 36, yStart + 26);
    doc.line(colX + 38, yStart + 26.5, colX + 54, yStart + 26.5);
  }
}

/**
 * Desenha a grade com todas as informações reais da atividade (conforme a ficha de referência industrial).
 * Retorna a coordenada Y final onde termina a grade de informações.
 */
function drawActivityInfoGrid(doc: jsPDF, activity: Activity, startY: number): number {
  const x = 10;
  const totalW = 190;
  let currentY = startY;

  // -------------------------------------------------------------
  // LINHA 1: CLIENTE / ÁREA | LOCAL | TIPO DE ATIVIDADE
  // -------------------------------------------------------------
  const row1H = 11;
  const col1_1W = 68;
  const col1_2W = 68;
  const col1_3W = totalW - col1_1W - col1_2W; // 54mm

  const clienteAreaVal = activity.location?.area || "-";
  const localVal = [activity.location?.local, activity.location?.equipment]
    .filter((v) => Boolean(v && v.trim() && v !== "-"))
    .join(" - ") || "-";
  const tipoAtivVal = activity.serviceType || activity.name || "-";

  drawGridCell(doc, x, currentY, col1_1W, row1H, "CLIENTE / ÁREA", clienteAreaVal);
  drawGridCell(doc, x + col1_1W, currentY, col1_2W, row1H, "LOCAL", localVal);
  drawGridCell(doc, x + col1_1W + col1_2W, currentY, col1_3W, row1H, "TIPO DE ATIVIDADE", tipoAtivVal, {
    drawRightBorder: false,
  });

  currentY += row1H;

  // -------------------------------------------------------------
  // LINHA 2: INÍCIO | TÉRMINO | EQUIPE | RESPONSÁVEL
  // -------------------------------------------------------------
  const row2H = 11;
  const col2_1W = 45;
  const col2_2W = 45;
  const col2_3W = 45;
  const col2_4W = totalW - (col2_1W + col2_2W + col2_3W); // 55mm

  const inicioVal = formatDateBR(activity.schedule?.actualStartDate || activity.schedule?.plannedStartDate);
  const terminoVal = formatDateBR(activity.schedule?.actualEndDate || activity.schedule?.plannedEndDate);
  const equipeVal = activity.team || activity.schedule?.teamName || "-";
  const responsavelVal = activity.assignedTo || "-";

  drawGridCell(doc, x, currentY, col2_1W, row2H, "INÍCIO", inicioVal);
  drawGridCell(doc, x + col2_1W, currentY, col2_2W, row2H, "TÉRMINO", terminoVal);
  drawGridCell(doc, x + col2_1W + col2_2W, currentY, col2_3W, row2H, "EQUIPE", equipeVal);
  drawGridCell(doc, x + col2_1W + col2_2W + col2_3W, currentY, col2_4W, row2H, "RESPONSÁVEL", responsavelVal, {
    drawRightBorder: false,
  });

  currentY += row2H;

  // -------------------------------------------------------------
  // LINHA 3: DESCRIÇÃO DA ATIVIDADE | MATERIAIS UTILIZADOS | ÁREA (m²) | Nº DE DEMÃOS
  // -------------------------------------------------------------
  const descRaw = activity.description && activity.description.trim() ? activity.description.trim() : "-";
  
  // Lista de materiais concatenada
  let matStr = "-";
  if (activity.plannedMaterials && activity.plannedMaterials.length > 0) {
    matStr = activity.plannedMaterials.map((m) => m.materialName).join(" / ");
  } else if (activity.consumptions && activity.consumptions.length > 0) {
    matStr = activity.consumptions.map((c) => c.materialName).join(" / ");
  }

  // Extrair coats e área dos materiais ou da atividade
  const areaVal = activity.serviceQuantity !== undefined && activity.serviceQuantity !== null
    ? `${activity.serviceQuantity} ${activity.serviceUnit || "m²"}`
    : activity.plannedMaterials?.find((m) => m.areaM2)?.areaM2
    ? `${activity.plannedMaterials.find((m) => m.areaM2)!.areaM2} m²`
    : "-";

  const demãosVal = activity.plannedMaterials?.find((m) => m.coats)?.coats
    ? String(activity.plannedMaterials.find((m) => m.coats)!.coats)
    : "-";

  // Calcular altura dinâmica da linha 3 baseada no texto da descrição e dos materiais
  const col3_1W = 86;
  const col3_2W = 58;
  const col3_3W = 24;
  const col3_4W = totalW - (col3_1W + col3_2W + col3_3W); // 22mm

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  const descLines = doc.splitTextToSize(descRaw, col3_1W - 4);
  const matLines = doc.splitTextToSize(matStr, col3_2W - 4);
  const maxContentLines = Math.max(descLines.length, matLines.length, 1);
  const row3H = Math.min(26, Math.max(12, 7.5 + maxContentLines * 3.5));

  drawGridCell(doc, x, currentY, col3_1W, row3H, "DESCRIÇÃO DA ATIVIDADE", descRaw, {
    maxLines: Math.floor((row3H - 7) / 3.4),
  });
  drawGridCell(doc, x + col3_1W, currentY, col3_2W, row3H, "MATERIAIS UTILIZADOS", matStr, {
    maxLines: Math.floor((row3H - 7) / 3.4),
  });
  drawGridCell(doc, x + col3_1W + col3_2W, currentY, col3_3W, row3H, "ÁREA", areaVal);
  drawGridCell(doc, x + col3_1W + col3_2W + col3_3W, currentY, col3_4W, row3H, "Nº DE DEMÃOS", demãosVal, {
    drawRightBorder: false,
  });

  currentY += row3H;

  // -------------------------------------------------------------
  // LINHA 4: OBSERVAÇÕES
  // -------------------------------------------------------------
  const obsRaw = activity.observations && activity.observations.trim() ? activity.observations.trim() : "-";
  const obsLines = doc.splitTextToSize(obsRaw, totalW - 4);
  const row4H = Math.min(22, Math.max(10, 7.5 + obsLines.length * 3.4));

  drawGridCell(doc, x, currentY, totalW, row4H, "OBSERVAÇÕES", obsRaw, {
    drawRightBorder: false,
    maxLines: Math.floor((row4H - 7) / 3.4),
  });

  currentY += row4H;

  return currentY;
}

/**
 * Desenha a barra de título da seção fotográfica ("REGISTRO FOTOGRÁFICO" ou "REGISTRO FOTOGRÁFICO — CONTINUAÇÃO").
 */
function drawPhotoSectionHeader(doc: jsPDF, y: number, isContinuation = false): number {
  const x = 10;
  const totalW = 190;
  const barH = 6;

  // Fundo cinza suave industrial
  doc.setFillColor(235, 238, 242);
  doc.rect(x, y, totalW, barH, "F");

  // Linhas delimitadoras
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(x, y, x + totalW, y);
  doc.line(x, y + barH, x + totalW, y + barH);

  // Texto
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  const text = isContinuation ? "REGISTRO FOTOGRÁFICO — CONTINUAÇÃO" : "REGISTRO FOTOGRÁFICO";
  doc.text(text, x + 2.5, y + 4.2);

  return y + barH;
}

/**
 * Renderiza uma foto dentro da caixa delimitadora com proporções preservadas e legenda.
 */
function renderPhotoBox(
  doc: jsPDF,
  photo: LoadedPdfImage,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
): void {
  // Borda da caixa de foto
  doc.setDrawColor(200, 205, 215);
  doc.setLineWidth(0.3);
  doc.rect(boxX, boxY, boxW, boxH);

  const captionH = 5;
  const availW = boxW - 2;
  const availH = boxH - captionH - 2;

  // Manter proporção original (aspect ratio) da imagem
  let drawW = availW;
  let drawH = (photo.height * availW) / photo.width;

  if (drawH > availH) {
    drawH = availH;
    drawW = (photo.width * availH) / photo.height;
  }

  const imgX = boxX + 1 + (availW - drawW) / 2;
  const imgY = boxY + 1 + (availH - drawH) / 2;

  try {
    doc.addImage(photo.dataUrl, photo.format, imgX, imgY, drawW, drawH);
  } catch (err) {
    console.warn(`[renderPhotoBox] Erro ao renderizar imagem "${photo.filename}":`, err);
  }

  // Linha da legenda
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.2);
  doc.line(boxX, boxY + boxH - captionH, boxX + boxW, boxY + boxH - captionH);

  // Texto da legenda (nome do arquivo legível)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(70, 80, 95);
  const captionLines = doc.splitTextToSize(photo.filename, boxW - 4);
  doc.text(captionLines[0] || "Registro de Campo", boxX + 2, boxY + boxH - 1.5);
}

/**
 * Renderiza o documento completo de uma atividade individual seguindo a referência visual oficial RSS3.
 * Suporta múltiplas páginas caso o número de fotos exceda a capacidade da página 1.
 * Retorna as páginas de início e fim da atividade.
 */
function renderOfficialActivityDocument(
  doc: jsPDF,
  activity: Activity,
  pageStartInfo: { isFirstActivity: boolean },
  loadedPhotos?: LoadedPdfImage[]
): { startPage: number; endPage: number } {
  if (!pageStartInfo.isFirstActivity) {
    doc.addPage();
  }

  const startPageNum = doc.getNumberOfPages();
  const photos = loadedPhotos || [];
  const signatureFooterH = 30; // Altura reservada para assinaturas no rodapé da página final (257 a 287)
  const bottomMargin = 287; // Y máximo da borda externa

  // ==========================================================================
  // PÁGINA 1
  // ==========================================================================
  const infoEndY = drawActivityInfoGrid(doc, activity, 32); // Cabeçalho termina em Y=32
  const photoBarEndY = drawPhotoSectionHeader(doc, infoEndY, false);

  // Espaço disponível para fotos na página 1 (se houver apenas 1 página, desconta as assinaturas)
  // Capacidade da página 1 com assinaturas:
  // Altura disponível: (287 - 30) - photoBarEndY
  const availHPage1WithSig = bottomMargin - signatureFooterH - photoBarEndY;

  // Decisão de Paginação:
  // Se tivermos 0 a 4 fotos: cabe tudo na página 1 com assinaturas.
  // Se tivermos mais de 4 fotos:
  //   Página 1: pode conter 4 fotos (2x2) aproveitando o espaço até antes das assinaturas,
  //   ou as fotos continuam em páginas seguintes, e as assinaturas vão para a ÚLTIMA página.
  const photosPerPage1 = 4;
  const photosPerSubsequentPage = 6; // Páginas adicionais têm cabeçalho curto e sem tabela de info

  let totalPagesForActivity = 1;
  if (photos.length > photosPerPage1) {
    const remainingPhotos = photos.length - photosPerPage1;
    // Na última página, se o número de fotos restantes deixar espaço para assinaturas:
    totalPagesForActivity = 1 + Math.ceil(remainingPhotos / photosPerSubsequentPage);
  }

  // Renderizar Página 1
  const isLastPage = totalPagesForActivity === 1;

  // Borda externa página 1
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(10, 10, 190, 277);

  // Cabeçalho da página 1 (placeholder de página temporário ou definitivo)
  // Guardamos informações de página para atualizar no final
  drawOfficialHeader(doc, activity.orderNumber, `1/${totalPagesForActivity}`, false);

  // Renderizar fotos da Página 1
  const page1Photos = photos.slice(0, photosPerPage1);
  const currentPhotoAreaTop = photoBarEndY + 2;
  const currentPhotoAreaBottom = isLastPage ? bottomMargin - signatureFooterH - 2 : bottomMargin - 4;
  const currentPhotoAreaH = currentPhotoAreaBottom - currentPhotoAreaTop;

  if (page1Photos.length > 0) {
    const count = page1Photos.length;
    if (count === 1) {
      // 1 foto centralizada e ampla
      const boxW = 140;
      const boxH = Math.min(currentPhotoAreaH - 4, 110);
      const boxX = 10 + (190 - boxW) / 2;
      const boxY = currentPhotoAreaTop + (currentPhotoAreaH - boxH) / 2;
      renderPhotoBox(doc, page1Photos[0], boxX, boxY, boxW, boxH);
    } else if (count === 2) {
      // 2 fotos lado a lado
      const gap = 4;
      const boxW = (190 - gap - 6) / 2;
      const boxH = Math.min(currentPhotoAreaH - 4, 90);
      const boxY = currentPhotoAreaTop + (currentPhotoAreaH - boxH) / 2;
      renderPhotoBox(doc, page1Photos[0], 13, boxY, boxW, boxH);
      renderPhotoBox(doc, page1Photos[1], 13 + boxW + gap, boxY, boxW, boxH);
    } else {
      // 3 ou 4 fotos em grade 2x2
      const gap = 4;
      const boxW = (190 - gap - 6) / 2;
      const rowH = (currentPhotoAreaH - gap - 4) / 2;
      const boxH = Math.min(rowH, 80);

      // Linha 1
      renderPhotoBox(doc, page1Photos[0], 13, currentPhotoAreaTop + 2, boxW, boxH);
      if (page1Photos[1]) {
        renderPhotoBox(doc, page1Photos[1], 13 + boxW + gap, currentPhotoAreaTop + 2, boxW, boxH);
      }
      // Linha 2
      if (page1Photos[2]) {
        renderPhotoBox(doc, page1Photos[2], 13, currentPhotoAreaTop + 2 + boxH + gap, boxW, boxH);
      }
      if (page1Photos[3]) {
        renderPhotoBox(doc, page1Photos[3], 13 + boxW + gap, currentPhotoAreaTop + 2 + boxH + gap, boxW, boxH);
      }
    }
  }

  // Se houver apenas 1 página, desenha as assinaturas no rodapé da página 1
  if (isLastPage) {
    drawSignaturesFooter(doc, bottomMargin - signatureFooterH);
  }

  // ==========================================================================
  // PÁGINAS ADICIONAIS (SE HOUVER MAIS FOTOS)
  // ==========================================================================
  let photoIndex = photosPerPage1;
  let currentPageIndex = 2;

  while (photoIndex < photos.length) {
    doc.addPage();

    // Borda externa
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(10, 10, 190, 277);

    // Cabeçalho de continuação
    drawOfficialHeader(doc, activity.orderNumber, `${currentPageIndex}/${totalPagesForActivity}`, true);

    const isThisLastPage = currentPageIndex === totalPagesForActivity;

    // Seção de continuação fotográfica
    const barY = drawPhotoSectionHeader(doc, 32, true);
    const subPhotoAreaTop = barY + 3;
    const subPhotoAreaBottom = isThisLastPage ? bottomMargin - signatureFooterH - 2 : bottomMargin - 4;
    const subPhotoAreaH = subPhotoAreaBottom - subPhotoAreaTop;

    // Quantas fotos nesta página?
    // Se for a última página e tiver assinaturas, cabem até 4 fotos (2x2).
    // Se não for a última página, cabem até 6 fotos (3x2).
    const maxPhotosThisPage = isThisLastPage ? 4 : 6;
    const currentBatch = photos.slice(photoIndex, photoIndex + maxPhotosThisPage);

    const gap = 4;
    const boxW = (190 - gap - 6) / 2;

    if (currentBatch.length <= 2) {
      const boxH = Math.min(subPhotoAreaH - 6, 95);
      const boxY = subPhotoAreaTop + (subPhotoAreaH - boxH) / 2;
      renderPhotoBox(doc, currentBatch[0], 13, boxY, boxW, boxH);
      if (currentBatch[1]) {
        renderPhotoBox(doc, currentBatch[1], 13 + boxW + gap, boxY, boxW, boxH);
      }
    } else if (currentBatch.length <= 4) {
      const rowH = (subPhotoAreaH - gap - 4) / 2;
      const boxH = Math.min(rowH, 80);
      renderPhotoBox(doc, currentBatch[0], 13, subPhotoAreaTop + 2, boxW, boxH);
      renderPhotoBox(doc, currentBatch[1], 13 + boxW + gap, subPhotoAreaTop + 2, boxW, boxH);
      if (currentBatch[2]) {
        renderPhotoBox(doc, currentBatch[2], 13, subPhotoAreaTop + 2 + boxH + gap, boxW, boxH);
      }
      if (currentBatch[3]) {
        renderPhotoBox(doc, currentBatch[3], 13 + boxW + gap, subPhotoAreaTop + 2 + boxH + gap, boxW, boxH);
      }
    } else {
      // 5 ou 6 fotos (3 linhas x 2 colunas)
      const rowH = (subPhotoAreaH - gap * 2 - 4) / 3;
      const boxH = Math.min(rowH, 65);
      for (let bi = 0; bi < currentBatch.length; bi++) {
        const row = Math.floor(bi / 2);
        const col = bi % 2;
        const bX = col === 0 ? 13 : 13 + boxW + gap;
        const bY = subPhotoAreaTop + 2 + row * (boxH + gap);
        renderPhotoBox(doc, currentBatch[bi], bX, bY, boxW, boxH);
      }
    }

    // Se for a última página, desenha o bloco de assinaturas
    if (isThisLastPage) {
      drawSignaturesFooter(doc, bottomMargin - signatureFooterH);
    }

    photoIndex += currentBatch.length;
    currentPageIndex++;
  }

  const endPageNum = doc.getNumberOfPages();
  return { startPage: startPageNum, endPage: endPageNum };
}

/**
 * Gera e realiza o download do relatório oficial corporativo de uma atividade individual em PDF.
 */
export async function generateActivityPdf(
  activity: Activity,
  options?: GeneratePdfOptions
): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  let loadedPhotos: LoadedPdfImage[] | undefined = undefined;

  // Carregamento protegido e eficiente de fotos
  if (options?.includePhotos) {
    let activityPhotos = activity.photos;

    if (!activityPhotos || activityPhotos.length === 0 || !activityPhotos.some((p) => p.signedUrl)) {
      try {
        activityPhotos = await getActivityPhotos(activity.id, true);
      } catch (pErr) {
        console.warn("[generateActivityPdf] Falha ao carregar fotos da atividade:", pErr);
        activityPhotos = [];
      }
    }

    if (activityPhotos && activityPhotos.length > 0) {
      const loadPromises = activityPhotos.map((photo) => loadPdfImageSafe(photo));
      const results = await Promise.all(loadPromises);
      const validImages = results.filter((img): img is LoadedPdfImage => img !== null);
      if (validImages.length > 0) {
        loadedPhotos = validImages;
      }
    }
  }

  renderOfficialActivityDocument(
    doc,
    activity,
    { isFirstActivity: true },
    loadedPhotos
  );

  // Download com nome padronizado
  const cleanOrder = sanitizeFileName(activity.orderNumber);
  const fileName = `OS_${cleanOrder}_Relatorio_Atividade.pdf`;
  doc.save(fileName);
}

/**
 * Gera e realiza o download de um ÚNICO arquivo PDF contendo todas as atividades selecionadas.
 * Cada atividade inicia obrigatoriamente em uma nova página com a sua estrutura oficial completa.
 */
export async function generateActivitiesPdf(
  activities: Activity[],
  options?: GeneratePdfOptions
): Promise<boolean> {
  if (!activities || activities.length === 0) {
    return false;
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  for (let index = 0; index < activities.length; index++) {
    const activity = activities[index];
    const isFirstActivity = index === 0;

    let loadedPhotos: LoadedPdfImage[] | undefined = undefined;

    if (options?.includePhotos) {
      let activityPhotos = activity.photos;
      if (!activityPhotos || activityPhotos.length === 0 || !activityPhotos.some((p) => p.signedUrl)) {
        try {
          activityPhotos = await getActivityPhotos(activity.id, true);
        } catch (pErr) {
          console.warn(`[generateActivitiesPdf] Falha ao carregar fotos da OS ${activity.orderNumber}:`, pErr);
          activityPhotos = [];
        }
      }

      if (activityPhotos && activityPhotos.length > 0) {
        const loadPromises = activityPhotos.map((photo) => loadPdfImageSafe(photo));
        const results = await Promise.all(loadPromises);
        const validImages = results.filter((img): img is LoadedPdfImage => img !== null);
        if (validImages.length > 0) {
          loadedPhotos = validImages;
        }
      }
    }

    renderOfficialActivityDocument(
      doc,
      activity,
      { isFirstActivity },
      loadedPhotos
    );
  }

  // Nome do arquivo consolidado oficial
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const fileName = `atividades-pintura-rss3-${day}-${month}-${year}.pdf`;

  doc.save(fileName);
  return true;
}
