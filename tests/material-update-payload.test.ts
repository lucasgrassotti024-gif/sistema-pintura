import { NewMaterialInput } from "../src/modules/materiais/types/material.types";

/**
 * Simula a transformação exata realizada no payload de updateMaterial
 */
function prepareMaterialUpdatePayload(
  input: NewMaterialInput & { active?: boolean }
) {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  const type = input.type.trim();
  const unit = input.unit.trim();
  const minimumStock = Number(input.minimumStock) || 0;

  if (!code) throw new Error("Código do material é obrigatório.");
  if (!name) throw new Error("Nome do material é obrigatório.");
  if (!type) throw new Error("Tipo do material é obrigatório.");
  if (!unit) throw new Error("Unidade de medida é obrigatória.");

  const consumptionPerM2 =
    input.consumptionPerM2PerCoat !== undefined &&
    input.consumptionPerM2PerCoat !== null &&
    !isNaN(Number(input.consumptionPerM2PerCoat))
      ? Number(input.consumptionPerM2PerCoat)
      : null;

  const packageVol =
    input.packageVolume !== undefined &&
    input.packageVolume !== null &&
    !isNaN(Number(input.packageVolume))
      ? Number(input.packageVolume)
      : null;

  return {
    code,
    name,
    type,
    manufacturer: input.manufacturer?.trim() || null,
    color: input.color?.trim() || null,
    unit,
    minimum_stock: minimumStock,
    location: input.location?.trim() || null,
    technical_info: input.technicalInfo?.trim() || null,
    consumption_per_m2_per_coat: consumptionPerM2,
    consumption_unit: input.consumptionUnit?.trim() || (consumptionPerM2 ? "L/m²/demão" : null),
    package_type: input.packageType?.trim() || null,
    package_volume: packageVol,
    active: input.active ?? true,
  };
}

function runAuditTests() {
  console.log("=== INICIANDO BATERIA DE TESTES DE AUDITORIA DO CRUD DE MATERIAIS ===");
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: unknown) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail);
    }
  }

  // Teste A: Editar apenas um campo antigo (ex: nome e fabricante)
  const tA = prepareMaterialUpdatePayload({
    code: "MAT-TEST-01",
    name: "Tinta Poliuretano Brilhante",
    type: "Acabamento PU",
    unit: "L",
    minimumStock: 10,
    manufacturer: "WEG Tintas",
    color: "Azul Segurança",
    location: "Almoxarifado A - Prateleira 01",
    technicalInfo: "Aplicar com trincha ou rolo",
  });
  assert(tA.name === "Tinta Poliuretano Brilhante", "Teste A: Nome atualizado");
  assert(tA.manufacturer === "WEG Tintas", "Teste A: Fabricante atualizado");
  assert(tA.consumption_per_m2_per_coat === null, "Teste A: Consumo permanece null se não informado");
  assert(tA.package_volume === null, "Teste A: Volume permanece null se não informado");

  // Teste B: Editar apenas os novos campos técnicos (Consumo, Unidade, Embalagem, Volume)
  const tB = prepareMaterialUpdatePayload({
    code: "MAT-TEST-02",
    name: "Primer Epóxi",
    type: "Fundo Epóxi",
    unit: "L",
    minimumStock: 25,
    consumptionPerM2PerCoat: 0.20,
    consumptionUnit: "L/m²/demão",
    packageType: "Galão",
    packageVolume: 3.6,
  });
  assert(tB.consumption_per_m2_per_coat === 0.20, "Teste B: Consumo 0.20 L/m²");
  assert(tB.consumption_unit === "L/m²/demão", "Teste B: Unidade de consumo salva");
  assert(tB.package_type === "Galão", "Teste B: Tipo Galão");
  assert(tB.package_volume === 3.6, "Teste B: Volume 3.6 L");

  // Teste B.2: Alterar os 4 campos técnicos para novos valores (0.25, Balde, 18L)
  const tB2 = prepareMaterialUpdatePayload({
    code: "MAT-TEST-02",
    name: "Primer Epóxi",
    type: "Fundo Epóxi",
    unit: "L",
    minimumStock: 25,
    consumptionPerM2PerCoat: 0.25,
    consumptionUnit: "L/m²/demão",
    packageType: "Balde",
    packageVolume: 18,
  });
  assert(tB2.consumption_per_m2_per_coat === 0.25, "Teste B.2: Consumo alterado para 0.25 L/m²");
  assert(tB2.package_type === "Balde", "Teste B.2: Tipo alterado para Balde");
  assert(tB2.package_volume === 18, "Teste B.2: Volume alterado para 18 L");

  // Teste C: Editar vários campos simultaneamente (código, nome, tipo, mínimo, técnico, ativo)
  const tC = prepareMaterialUpdatePayload({
    code: " mat-new-03 ",
    name: "Esmalte Sintético Industrial",
    type: "Alta Temperatura",
    unit: "gal",
    minimumStock: 50,
    manufacturer: "Sherwin Williams",
    color: "Cinza Claro",
    location: "Almoxarifado Químico",
    technicalInfo: "Diluir a 10% com xilol",
    consumptionPerM2PerCoat: 0.12,
    packageType: "Lata",
    packageVolume: 18,
    active: false,
  });
  assert(tC.code === "MAT-NEW-03", "Teste C: Código sanitizado uppercase e trim");
  assert(tC.unit === "gal", "Teste C: Unidade 'gal' aceita");
  assert(tC.minimum_stock === 50, "Teste C: Estoque mínimo 50");
  assert(tC.active === false, "Teste C: Status inativo gravado com sucesso");
  assert(tC.consumption_per_m2_per_coat === 0.12, "Teste C: Consumo simultâneo correto");

  // Teste D: Remover dados técnicos anteriormente preenchidos e confirmar persistência de NULL
  const tD = prepareMaterialUpdatePayload({
    code: "MAT-TEST-04",
    name: "Tíner de Limpeza",
    type: "Solvente / Diluente",
    unit: "L",
    minimumStock: 100,
    consumptionPerM2PerCoat: null,
    consumptionUnit: null,
    packageType: null,
    packageVolume: null,
    manufacturer: null,
    color: "",
    technicalInfo: "   ",
  });
  assert(tD.consumption_per_m2_per_coat === null, "Teste D: Consumo zerado vira NULL");
  assert(tD.consumption_unit === null, "Teste D: Unidade de consumo zerada vira NULL");
  assert(tD.package_type === null, "Teste D: Tipo de embalagem zerado vira NULL");
  assert(tD.package_volume === null, "Teste D: Volume zerado vira NULL");
  assert(tD.manufacturer === null, "Teste D: Fabricante vazio vira NULL");
  assert(tD.color === null, "Teste D: Cor vazia vira NULL");
  assert(tD.technical_info === null, "Teste D: Informação técnica em branco vira NULL");

  // Teste E: Todos os presets de embalagem comerciais
  const packagePresets = [
    { type: "Galão", vol: 3.6 },
    { type: "Balde", vol: 18 },
    { type: "Lata", vol: 18 },
    { type: "Quarto (0,9 L)", vol: 0.9 },
    { type: "Tambor", vol: 200 },
    { type: "Frasco Especial", vol: 0.5 },
  ];
  for (const pkg of packagePresets) {
    const payload = prepareMaterialUpdatePayload({
      code: "MAT-PKG",
      name: "Tinta Teste",
      type: "Fundo Epóxi",
      unit: "L",
      minimumStock: 5,
      packageType: pkg.type,
      packageVolume: pkg.vol,
    });
    assert(
      payload.package_type === pkg.type && payload.package_volume === pkg.vol,
      `Teste E: Embalagem ${pkg.type} com ${pkg.vol} L preservada com exatidão`
    );
  }

  // Teste F: Validações defensivas de campos obrigatórios
  let threwCode = false;
  try {
    prepareMaterialUpdatePayload({
      code: "  ",
      name: "Tinta",
      type: "Fundo Epóxi",
      unit: "L",
      minimumStock: 10,
    });
  } catch {
    threwCode = true;
  }
  assert(threwCode, "Teste F: Rejeita código vazio");

  let threwName = false;
  try {
    prepareMaterialUpdatePayload({
      code: "MAT-1",
      name: "",
      type: "Fundo Epóxi",
      unit: "L",
      minimumStock: 10,
    });
  } catch {
    threwName = true;
  }
  assert(threwName, "Teste F: Rejeita nome vazio");

  console.log(`\n=== RESULTADO DOS TESTES DE AUDITORIA: ${passed}/${total} PASSARAM ===`);
  if (passed !== total) {
    process.exit(1);
  }
}

runAuditTests();
