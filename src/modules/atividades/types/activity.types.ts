export type ActivityStatus =
  | "programada"
  | "planejada"
  | "em_andamento"
  | "pausada"
  | "concluida"
  | "cancelada";

export interface ActivityTag {
  id: string;
  code: string;
}

export interface ActivityLocation {
  area: string;
  local: string;
  equipment: string;
}

export interface ActivityConsumption {
  id: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  registeredAt: string;
  registeredBy: string;
}

export interface ActivityPlannedMaterial {
  id: string;
  materialId?: string;
  materialCode?: string;
  materialName: string;
  quantity: number;
  unit: string;
}

export interface ActivitySchedule {
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  teamId?: string;
  teamName?: string;
}

export interface ActivityHistoryEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  oldProgress?: number;
  newProgress?: number;
  consumedMaterials?: Array<{ materialName: string; quantity: number; unit: string }>;
  observation?: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
}

export type ActivityPriority = "baixa" | "media" | "alta" | "urgente";

export interface Activity {
  id: string;
  orderNumber: string; // Nota
  name: string;
  serviceType?: string; // Tipo de serviço
  tags: ActivityTag[];
  location: ActivityLocation;
  description: string;
  status: ActivityStatus;
  priority: ActivityPriority;
  assignedTo?: string; // Responsável
  team?: string; // Equipe
  serviceQuantity?: number; // Quantidade do serviço
  serviceUnit?: string; // Unidade do serviço (m², m linear, etc)
  plannedMaterials?: ActivityPlannedMaterial[]; // Materiais planejados
  originReference?: string; // Origem/referência
  observations?: string; // Observações
  progressPercentage: number;
  schedule: ActivitySchedule;
  consumptions: ActivityConsumption[];
  history: ActivityHistoryEntry[];
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
  createdAt: string;
  updatedAt: string;
}
