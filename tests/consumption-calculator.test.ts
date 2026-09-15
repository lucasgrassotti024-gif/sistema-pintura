import { calculateMaterialRequirement } from "../src/modules/materiais/rules/consumption-calculator.rules";

function runTests() {
  console.log("=== INICIANDO BATERIA DE TESTES DE CÁLCULO DE CONSUMO ===");
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

  // Teste 1:
  // Área: 100 m²
  // Consumo: 0.20 L/m²/demão
  // Demãos: 2
  // Embalagem: Galão 3.6 L
  // Esperado: 40 L necessários, 12 galões
  const t1 = calculateMaterialRequirement({
    areaM2: 100,
    consumptionPerM2PerCoat: 0.2,
    coats: 2,
    packageVolume: 3.6,
    packageType: "Galão",
  });
  assert(t1.isValid === true, "Teste 1: Cálculo válido");
  assert(t1.litersRequired === 40, `Teste 1: Litros necessários = 40 L (obteve ${t1.litersRequired})`);
  assert(t1.packagesRequired === 12, `Teste 1: Embalagens = 12 galões (obteve ${t1.packagesRequired})`);
  assert(t1.packageSummary?.includes("12 galões de 3,6 L") ?? false, "Teste 1: Formatação de embalagens correta");

  // Teste 2:
  // Área: 250 m²
  // Consumo: 0.15 L/m²/demão
  // Demãos: 1
  // Embalagem: Balde 18 L
  // Esperado: 37.5 L necessários, 3 baldes (37.5 / 18 = 2.083 -> 3 baldes)
  const t2 = calculateMaterialRequirement({
    areaM2: 250,
    consumptionPerM2PerCoat: 0.15,
    coats: 1,
    packageVolume: 18,
    packageType: "Balde",
  });
  assert(t2.isValid === true, "Teste 2: Cálculo válido");
  assert(t2.litersRequired === 37.5, `Teste 2: Litros necessários = 37.5 L (obteve ${t2.litersRequired})`);
  assert(t2.packagesRequired === 3, `Teste 2: Embalagens = 3 baldes (obteve ${t2.packagesRequired})`);

  // Teste 3: Material sem consumo técnico
  const t3 = calculateMaterialRequirement({
    areaM2: 100,
    coats: 2,
  });
  assert(t3.isValid === false, "Teste 3: Inválido quando falta consumo");
  assert(t3.missingFields.includes("Consumo por m²/demão"), "Teste 3: Aponta campo ausente");
  assert(t3.litersRequired === 0, "Teste 3: Litros = 0 sem NaN");

  // Teste 4: Alterar área (100 -> 150 m²)
  const t4 = calculateMaterialRequirement({
    areaM2: 150,
    consumptionPerM2PerCoat: 0.2,
    coats: 2,
    packageVolume: 3.6,
  });
  assert(t4.litersRequired === 60, `Teste 4: Litros recalculados para 60 L (obteve ${t4.litersRequired})`);
  assert(t4.packagesRequired === 17, `Teste 4: Embalagens recalculadas para 17 (obteve ${t4.packagesRequired})`);

  // Teste 5: Alterar demãos (2 -> 3)
  const t5 = calculateMaterialRequirement({
    areaM2: 100,
    consumptionPerM2PerCoat: 0.2,
    coats: 3,
    packageVolume: 3.6,
  });
  assert(t5.litersRequired === 60, `Teste 5: Litros com 3 demãos = 60 L (obteve ${t5.litersRequired})`);
  assert(t5.packagesRequired === 17, `Teste 5: Embalagens com 3 demãos = 17 (obteve ${t5.packagesRequired})`);

  // Teste 6: Precisão de números fracionados (123.5 m² x 0.185 L/m² x 2 demãos = 45.695 L)
  const t6 = calculateMaterialRequirement({
    areaM2: 123.5,
    consumptionPerM2PerCoat: 0.185,
    coats: 2,
    packageVolume: 3.6,
    packageType: "Galão",
  });
  assert(t6.litersRequired === 45.695, `Teste 6: Precisão sem distorção = 45.695 L (obteve ${t6.litersRequired})`);
  assert(t6.packagesRequired === 13, `Teste 6: Embalagens = 13 galões (45.695 / 3.6 = 12.69 -> 13) (obteve ${t6.packagesRequired})`);

  // Teste 7: Valores inválidos ou zero
  const t7 = calculateMaterialRequirement({
    areaM2: -10,
    consumptionPerM2PerCoat: 0,
    coats: -1,
  });
  assert(t7.isValid === false, "Teste 7: Bloqueia valores negativos e zero");
  assert(t7.litersRequired === 0, "Teste 7: Não gera NaN");

  console.log(`\n=== RESULTADO: ${passed}/${total} TESTES PASSARAM ===`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
