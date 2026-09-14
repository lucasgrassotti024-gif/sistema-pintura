export interface MaterialCalculationInput {
  areaM2: number;
  coats: number;
  consumptionPerM2PerCoat: number;
  packageVolume?: number | null;
  packageType?: string | null;
}

export interface MaterialCalculationResult {
  isValid: boolean;
  litersRequired: number;
  packagesRequired: number | null;
  packageVolume: number | null;
  packageType: string | null;
  coats: number;
  areaM2: number;
  consumptionPerM2PerCoat: number;
  formulaDescription: string;
  packageSummary?: string;
  missingFields: string[];
}

/**
 * Função técnica centralizada de cálculo de consumo de material de pintura por área.
 * 
 * Regra:
 *   Litros Necessários = Área (m²) × Consumo por m² por demão (L/m²/demão) × Quantidade de Demãos
 *   Quantidade de Embalagens = ceil(Litros Necessários / Volume da Embalagem)
 *
 * Precisão e Arredondamento:
 *   - Litros necessários mantêm o valor preciso numérico real sem arredondamento forçado para cima.
 *   - Embalagens arredondam estritamente para cima com Math.ceil (compra de fracionados não é permitida).
 *   - Se faltar consumo ou dados essenciais, o cálculo é considerado incompleto sem emitir NaN ou Infinity.
 */
export function calculateMaterialRequirement(
  input: Partial<MaterialCalculationInput>
): MaterialCalculationResult {
  const missingFields: string[] = [];

  const areaM2 = Number(input.areaM2);
  const coats = Number(input.coats);
  const consumption = Number(input.consumptionPerM2PerCoat);
  const packageVolume = input.packageVolume ? Number(input.packageVolume) : null;
  const packageType = input.packageType?.trim() || null;

  if (isNaN(areaM2) || areaM2 <= 0) {
    missingFields.push("Área (m²)");
  }
  if (isNaN(coats) || coats <= 0) {
    missingFields.push("Quantidade de demãos");
  }
  if (isNaN(consumption) || consumption <= 0) {
    missingFields.push("Consumo por m²/demão");
  }

  if (missingFields.length > 0) {
    return {
      isValid: false,
      litersRequired: 0,
      packagesRequired: null,
      packageVolume: packageVolume && packageVolume > 0 ? packageVolume : null,
      packageType,
      coats: isNaN(coats) || coats <= 0 ? 1 : coats,
      areaM2: isNaN(areaM2) || areaM2 <= 0 ? 0 : areaM2,
      consumptionPerM2PerCoat: isNaN(consumption) || consumption <= 0 ? 0 : consumption,
      formulaDescription: "Dados incompletos para cálculo automático",
      missingFields,
    };
  }

  // Cálculo real preciso dos litros necessários
  // Ex: 100 m² * 0.20 L/m² * 2 demãos = 40 L
  const rawLiters = areaM2 * consumption * coats;
  // Arredonda a 3 casas decimais numéricas para evitar erros de ponto flutuante do IEEE 754 (ex: 40.00000000000001)
  const litersRequired = Math.round(rawLiters * 1000) / 1000;

  let packagesRequired: number | null = null;
  let packageSummary: string | undefined = undefined;

  if (packageVolume && packageVolume > 0) {
    // Arredondamento estritamente para cima para quantidade de embalagens fechadas
    packagesRequired = Math.ceil(litersRequired / packageVolume);
    const typeLabel = packageType ? `${packageType.toLowerCase()}${packagesRequired > 1 ? "ões" : ""}` : "embalagens";
    // Ajuste de plural amigável para galão/balde/lata
    let pluralLabel = packageType || "embalagem(ns)";
    if (packageType) {
      const lower = packageType.toLowerCase();
      if (lower === "galão") pluralLabel = packagesRequired > 1 ? "galões" : "galão";
      else if (lower === "balde") pluralLabel = packagesRequired > 1 ? "baldes" : "balde";
      else if (lower === "lata") pluralLabel = packagesRequired > 1 ? "latas" : "lata";
      else pluralLabel = packagesRequired > 1 ? `${packageType}s` : packageType;
    }

    const formattedVol = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(packageVolume);
    packageSummary = `${packagesRequired} ${pluralLabel} de ${formattedVol} L`;
  } else {
    missingFields.push("Volume da embalagem");
  }

  const formatNum = (val: number) =>
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(val);

  const formulaDescription = `${formatNum(areaM2)} m² × ${formatNum(consumption)} L/m² × ${coats} demão${coats > 1 ? "s" : ""} = ${formatNum(litersRequired)} L`;

  return {
    isValid: true,
    litersRequired,
    packagesRequired,
    packageVolume,
    packageType,
    coats,
    areaM2,
    consumptionPerM2PerCoat: consumption,
    formulaDescription,
    packageSummary,
    missingFields,
  };
}
