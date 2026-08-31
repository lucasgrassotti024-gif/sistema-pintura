export type MaterialStockStatus = "adequado" | "atencao" | "critico";

export interface Material {
  id: string;
  code: string;
  name: string;
  type: string;
  manufacturer?: string;
  color?: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  location?: string;
  technicalInfo?: string;
  active: boolean;
  status: MaterialStockStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockMovement {
  id: string;
  materialId: string;
  movementType: "entrada";
  quantity: number;
  previousStock: number;
  newStock: number;
  batch?: string;
  expirationDate?: string;
  documentReference?: string;
  observation?: string;
  userId?: string;
  createdAt: string;
}

export interface NewMaterialInput {
  code: string;
  name: string;
  type: string;
  manufacturer?: string;
  color?: string;
  unit: string;
  minimumStock: number;
  location?: string;
  technicalInfo?: string;
}

export interface StockEntryInput {
  materialId: string;
  quantity: number;
  batch?: string;
  expirationDate?: string;
  documentReference?: string;
  observation?: string;
}

export const MOCK_MATERIALS: Material[] = [
  {
    id: "mat-1",
    code: "MAT-EPOXI-01",
    name: "Primer Epóxi Poliamida Cinza",
    type: "Fundo Epóxi",
    manufacturer: "Tintas Industriais SA",
    color: "Cinza Munsell N 6,5",
    unit: "L",
    currentStock: 48,
    minimumStock: 100,
    location: "Almoxarifado A - Prateleira 02",
    active: true,
    status: "critico",
    technicalInfo: "Fundo anticorrosivo epóxi bicomponente para ambientes industriais agressivos.",
  },
  {
    id: "mat-2",
    code: "MAT-PU-02",
    name: "Acabamento Poliuretano Alifático Branco",
    type: "Acabamento PU",
    manufacturer: "Tintas Industriais SA",
    color: "Branco Neve",
    unit: "L",
    currentStock: 120,
    minimumStock: 80,
    location: "Almoxarifado A - Prateleira 03",
    active: true,
    status: "adequado",
    technicalInfo: "Esmalte poliuretano de alta retenção de cor e brilho para intempéries.",
  },
  {
    id: "mat-3",
    code: "MAT-SILIC-03",
    name: "Tinta Silicone Alta Temperatura 400°C Alumínio",
    type: "Alta Temperatura",
    manufacturer: "TermoCoat",
    color: "Alumínio",
    unit: "L",
    currentStock: 15,
    minimumStock: 30,
    location: "Almoxarifado Químico",
    active: true,
    status: "critico",
    technicalInfo: "Tinta monocomponente resistente ao calor contínuo em caldeiras e chaminés.",
  },
  {
    id: "mat-4",
    code: "MAT-DILU-04",
    name: "Diluente Epóxi Padrão",
    type: "Solvente / Diluente",
    manufacturer: "SolvQuim",
    unit: "L",
    currentStock: 85,
    minimumStock: 80,
    location: "Almoxarifado Químico",
    active: true,
    status: "atencao",
    technicalInfo: "Solvente para ajuste de viscosidade e limpeza de ferramentas de epóxi.",
  },
];

