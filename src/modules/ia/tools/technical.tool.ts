import { FunctionDeclaration, Type } from "@google/genai";

/**
 * Declarações de ferramentas para cálculos técnicos e normas de pintura industrial.
 */
export const technicalDeclarations: FunctionDeclaration[] = [
  {
    name: "calcularRendimentoTinta",
    description:
      "Calcula matematicamente o rendimento teórico (m²/L), rendimento prático considerando percentual de perda e a quantidade total de tinta necessária para cobrir uma determinada área em m² e espessura de película seca (EPS) em micrômetros (μm).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        solidosPorVolume: {
          type: Type.NUMBER,
          description: "Percentual de sólidos por volume da tinta (ex: 60 para 60%, 80 para 80%, etc.). Se desconhecido, primer epóxi típico varia entre 60% e 80%.",
        },
        espessuraPelículaSecaMicras: {
          type: Type.NUMBER,
          description: "Espessura de Película Seca (EPS) desejada por demão em micrômetros (μm) (ex: 100, 120, 150).",
        },
        areaTotalM2: {
          type: Type.NUMBER,
          description: "Área total da estrutura ou peça em metros quadrados (m²).",
        },
        metodoAplicacao: {
          type: Type.STRING,
          description: "Método de aplicação pretendido: 'pistola_airless', 'pistola_convencional', 'rolo' ou 'trincha'.",
        },
        numeroDemaos: {
          type: Type.NUMBER,
          description: "Número de demãos planejadas (padrão: 1).",
        },
      },
      required: ["solidosPorVolume", "espessuraPelículaSecaMicras"],
    },
  },
  {
    name: "consultarNormaTecnicaPintura",
    description:
      "Consulta diretrizes normativas de pintura industrial (normas Petrobras N-1201, N-13, N-2680, ISO 8501-1, SSPC, NBR) sobre preparação de superfície, graus de intemperismo, intervalos entre demãos e tolerâncias de EPS.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        topicoNormativo: {
          type: Type.STRING,
          description: "Assunto técnico a ser consultado (ex: 'preparacao_superficie_graus_iso_8501', 'perfil_rugosidade', 'criterio_80_20_eps', 'intervalo_entre_demaos_recoating', 'norma_petrobras_n1201').",
        },
      },
      required: ["topicoNormativo"],
    },
  },
];

/**
 * Fatores médios de perda por método de aplicação em pintura industrial pesada.
 */
const PERDAS_MEDIAS_METODO: Record<string, { perdaMin: number; perdaMax: number; perdaTipica: number }> = {
  pistola_airless: { perdaMin: 20, perdaMax: 40, perdaTipica: 30 },
  pistola_convencional: { perdaMin: 30, perdaMax: 50, perdaTipica: 40 },
  rolo: { perdaMin: 10, perdaMax: 25, perdaTipica: 15 },
  trincha: { perdaMin: 5, perdaMax: 15, perdaTipica: 10 },
};

/**
 * Base de conhecimento de normas técnicas de pintura industrial RSS3.
 */
const BASE_NORMATIVA: Record<string, { titulo: string; normaRef: string; resumo: string; detalhes: string[] }> = {
  preparacao_superficie_graus_iso_8501: {
    titulo: "Graus de Intemperismo e Padrões de Jateamento (ISO 8501-1 / SSPC)",
    normaRef: "ISO 8501-1 / SSPC-VIS 1 / Petrobras N-9",
    resumo: "Classificação do estado inicial do aço e padrões visuais de limpeza após preparação de superfície.",
    detalhes: [
      "Grau A: Superfície de aço com carepa de laminação intacta em quase toda a extensão, praticamente sem corrosão.",
      "Grau B: Superfície de aço com início de oxidação superficial e da qual a carepa de laminação começa a desprender-se.",
      "Grau C: Superfície de aço onde a carepa de laminação foi eliminada pela ferrugem, mas sem formação de cavidades visíveis (pites).",
      "Grau D: Superfície com corrosão generalizada e formação acentuada de cavidades e pites profundos.",
      "Padrões de Jato: Sa 1 (ligeiro/brush-off), Sa 2 (comercial), Sa 2.5 (ao metal quase branco - mais exigido na indústria naval/offshore/óleo e gás), Sa 3 (ao metal branco).",
    ],
  },
  criterio_80_20_eps: {
    titulo: "Critério de Aceitação de Espessura de Película Seca (Regra 80-20)",
    normaRef: "Petrobras N-1201 / SSPC-PA 2 / ISO 19840",
    resumo: "Critério de tolerância estatística para medição de película seca em inspeções de pintura industrial.",
    detalhes: [
      "Nenhuma medição individual pode ser inferior a 80% da EPS especificada no projeto.",
      "A média aritmética de todas as medições na área inspecionada deve ser igual ou superior à EPS especificada (100%).",
      "A espessura máxima pontual não deve ultrapassar o limite máximo estipulado pelo fabricante da tinta (geralmente 2x a 3x a EPS nominal para evitar fendilhamento/mud cracking).",
    ],
  },
  intervalo_entre_demaos_recoating: {
    titulo: "Intervalos Mínimo e Máximo Entre Demãos (Janela de Recoating)",
    normaRef: "Fichas Técnicas / Petrobras N-1201",
    resumo: "Controle de cura e adesão entre demãos consecutivas.",
    detalhes: [
      "Intervalo Mínimo: Tempo necessário para volatilização do solvente e início de cura que suporte a próxima demão sem sangramento ou amolecimento da camada anterior.",
      "Intervalo Máximo: Limite de tempo em que a película anterior ainda aceita aderência química ou mecânica da próxima demão. Se ultrapassado, exige lixamento prévio (quebra de brilho) para criar rugosidade mecânica.",
      "Atenção a variações de temperatura ambiente: em temperaturas mais baixas, o tempo de cura duplica; em temperaturas altas, a janela de sobrepintura encurta rapidamente.",
    ],
  },
  norma_petrobras_n1201: {
    titulo: "Execução e Inspeção de Pintura Industrial Petrobras",
    normaRef: "Petrobras N-1201 Rev. H",
    resumo: "Procedimento geral de aplicação de revestimentos de proteção anticorrosiva em estruturas industriais terrestres e marítimas.",
    detalhes: [
      "Condições ambientais obrigatórias para aplicação: Umidade Relativa do Ar (UR) máxima de 85%.",
      "Temperatura da superfície metálica: deve estar no mínimo 3°C acima do Ponto de Orvalho (Dew Point) para evitar condensação de umidade invisível sob a película.",
      "Perfil de rugosidade típico: especificado geralmente entre 40 μm e 75 μm (Grit/Shot) conforme o primer especificado.",
    ],
  },
};

/**
 * Executor da ferramenta de cálculo e normas de pintura.
 */
export async function executeTechnicalTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  if (toolName === "calcularRendimentoTinta") {
    const sv = Number(args.solidosPorVolume);
    const eps = Number(args.espessuraPelículaSecaMicras);
    const area = args.areaTotalM2 ? Number(args.areaTotalM2) : undefined;
    const metodo = String(args.metodoAplicacao || "pistola_airless").toLowerCase();
    const demaos = args.numeroDemaos ? Number(args.numeroDemaos) : 1;

    if (!sv || sv <= 0 || sv > 100) {
      return { erro: "Percentual de Sólidos por Volume (SV) deve ser um número entre 1 e 100." };
    }
    if (!eps || eps <= 0) {
      return { erro: "A Espessura de Película Seca (EPS) deve ser maior que zero." };
    }

    // Fórmula canônica: Rendimento Teórico (m²/L) = (SV * 10) / EPS
    const rendimentoTeoricoM2L = (sv * 10) / eps;

    // Fator de perda
    const perdaConfig = PERDAS_MEDIAS_METODO[metodo] || PERDAS_MEDIAS_METODO.pistola_airless;
    const fatorAproveitamento = 1 - perdaConfig.perdaTipica / 100;
    const rendimentoPraticoM2L = rendimentoTeoricoM2L * fatorAproveitamento;

    let consumoTeoricoTotalL: number | undefined;
    let consumoPraticoTotalL: number | undefined;

    if (area && area > 0) {
      consumoTeoricoTotalL = (area * demaos) / rendimentoTeoricoM2L;
      consumoPraticoTotalL = (area * demaos) / rendimentoPraticoM2L;
    }

    return {
      solidos_volume_percent: sv,
      eps_micras_demao: eps,
      numero_demaos: demaos,
      metodo_aplicacao: metodo,
      perda_tipica_estimada_percent: perdaConfig.perdaTipica,
      faixa_perda_metodo: `${perdaConfig.perdaMin}% a ${perdaConfig.perdaMax}%`,
      rendimento_teorico_m2_por_litro: Number(rendimentoTeoricoM2L.toFixed(2)),
      rendimento_pratico_m2_por_litro: Number(rendimentoPraticoM2L.toFixed(2)),
      area_calculada_m2: area,
      consumo_teorico_total_litros: consumoTeoricoTotalL ? Number(consumoTeoricoTotalL.toFixed(1)) : undefined,
      consumo_pratico_total_litros: consumoPraticoTotalL ? Number(consumoPraticoTotalL.toFixed(1)) : undefined,
      formula_utilizada: "Rendimento Teórico = (Sólidos por Volume % × 10) / EPS (μm)",
      nota_tecnica:
        "O rendimento prático varia conforme a complexidade geométrica da peça, rugosidade do aço (rugosidade consome tinta morta) e vento em campo.",
    };
  }

  if (toolName === "consultarNormaTecnicaPintura") {
    const rawTopic = String(args.topicoNormativo || "").toLowerCase();

    // Busca exata ou por similaridade na chave
    let matchedKey = Object.keys(BASE_NORMATIVA).find((k) => k === rawTopic || rawTopic.includes(k) || k.includes(rawTopic));

    if (!matchedKey) {
      if (rawTopic.includes("iso") || rawTopic.includes("grau") || rawTopic.includes("prepar") || rawTopic.includes("jato")) {
        matchedKey = "preparacao_superficie_graus_iso_8501";
      } else if (rawTopic.includes("80") || rawTopic.includes("20") || rawTopic.includes("tolerancia") || rawTopic.includes("eps")) {
        matchedKey = "criterio_80_20_eps";
      } else if (rawTopic.includes("recoat") || rawTopic.includes("demao") || rawTopic.includes("intervalo") || rawTopic.includes("cura")) {
        matchedKey = "intervalo_entre_demaos_recoating";
      } else {
        matchedKey = "norma_petrobras_n1201";
      }
    }

    const item = BASE_NORMATIVA[matchedKey];
    return {
      topico_consultado: rawTopic,
      norma_aplicavel: item.normaRef,
      titulo: item.titulo,
      resumo: item.resumo,
      requisitos_principais: item.detalhes,
    };
  }

  return { erro: `Ferramenta técnica '${toolName}' não reconhecida.` };
}
