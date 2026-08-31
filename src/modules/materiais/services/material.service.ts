import { createClient } from "@/lib/supabase/client";
import { Material, NewMaterialInput, StockEntryInput, StockMovement } from "../types/material.types";
import { calculateStockStatus } from "../rules/material.rules";

export interface SupabaseMaterialRow {
  id: string;
  code: string;
  name: string;
  type: string;
  manufacturer: string | null;
  color: string | null;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  location: string | null;
  technical_info: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupabaseStockMovementRow {
  id: string;
  material_id: string;
  movement_type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  batch: string | null;
  expiration_date: string | null;
  document_reference: string | null;
  observation: string | null;
  user_id: string | null;
  created_at: string;
}

export function mapRowToMaterial(row: SupabaseMaterialRow): Material {
  const currentStock = Number(row.current_stock) || 0;
  const minimumStock = Number(row.minimum_stock) || 0;

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    manufacturer: row.manufacturer || undefined,
    color: row.color || undefined,
    unit: row.unit,
    currentStock,
    minimumStock,
    location: row.location || undefined,
    technicalInfo: row.technical_info || undefined,
    active: row.active ?? true,
    status: calculateStockStatus(currentStock, minimumStock),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Carrega todos os materiais cadastrados no catálogo do Supabase
 */
export async function getMaterials(): Promise<Material[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("materials")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("[getMaterials] Erro ao carregar materiais do Supabase:", error);
    throw new Error(`Falha ao carregar materiais: ${error.message}`);
  }

  return (data || []).map((row) => mapRowToMaterial(row as SupabaseMaterialRow));
}

/**
 * Cadastra um novo tipo de material no catálogo do sistema (com saldo inicial 0.00)
 */
export async function createMaterial(input: NewMaterialInput): Promise<Material> {
  const supabase = createClient();

  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  const type = input.type.trim();
  const unit = input.unit.trim();
  const minimumStock = Number(input.minimumStock) || 0;

  if (!code) throw new Error("Código do material é obrigatório.");
  if (!name) throw new Error("Nome do material é obrigatório.");
  if (!type) throw new Error("Tipo do material é obrigatório.");
  if (!unit) throw new Error("Unidade de medida é obrigatória.");

  const { data, error } = await supabase
    .from("materials")
    .insert({
      code,
      name,
      type,
      manufacturer: input.manufacturer?.trim() || null,
      color: input.color?.trim() || null,
      unit,
      current_stock: 0.0,
      minimum_stock: minimumStock,
      location: input.location?.trim() || null,
      technical_info: input.technicalInfo?.trim() || null,
      active: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[createMaterial] Erro ao cadastrar material no Supabase:", error);
    throw new Error(`Erro ao cadastrar material: ${error?.message}`);
  }

  return mapRowToMaterial(data as SupabaseMaterialRow);
}

/**
 * Atualiza os dados cadastrais de um material existente no catálogo pelo ID.
 * NÃO altera current_stock e não gera movimentação de estoque.
 */
export async function updateMaterial(
  id: string,
  input: NewMaterialInput & { active?: boolean }
): Promise<Material> {
  const supabase = createClient();

  if (!id) throw new Error("ID do material é obrigatório.");

  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  const type = input.type.trim();
  const unit = input.unit.trim();
  const minimumStock = Number(input.minimumStock) || 0;

  if (!code) throw new Error("Código do material é obrigatório.");
  if (!name) throw new Error("Nome do material é obrigatório.");
  if (!type) throw new Error("Tipo do material é obrigatório.");
  if (!unit) throw new Error("Unidade de medida é obrigatória.");

  const { data, error } = await supabase
    .from("materials")
    .update({
      code,
      name,
      type,
      manufacturer: input.manufacturer?.trim() || null,
      color: input.color?.trim() || null,
      unit,
      minimum_stock: minimumStock,
      location: input.location?.trim() || null,
      technical_info: input.technicalInfo?.trim() || null,
      active: input.active ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[updateMaterial] Erro ao atualizar material no Supabase:", error);
    if (error?.code === "23505" || error?.message?.includes("uq_materials_code") || error?.message?.includes("code")) {
      throw new Error(`Já existe outro material cadastrado com o código "${code}".`);
    }
    throw new Error(`Erro ao atualizar material: ${error?.message}`);
  }

  return mapRowToMaterial(data as SupabaseMaterialRow);
}

/**
 * Desativa com segurança um material do catálogo (Soft Delete: active = false).
 * Preserva o histórico de movimentações, auditorias e consumos.
 */
export async function deleteMaterial(id: string): Promise<Material> {
  const supabase = createClient();

  if (!id) throw new Error("ID do material é obrigatório.");

  const { data, error } = await supabase
    .from("materials")
    .update({
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[deleteMaterial] Erro ao desativar material no Supabase:", error);
    throw new Error(`Erro ao inativar material: ${error?.message}`);
  }

  return mapRowToMaterial(data as SupabaseMaterialRow);
}

/**
 * Registra uma entrada física de estoque para um material existente via RPC atômica
 */
export async function registerStockEntry(input: StockEntryInput): Promise<{
  movementId: string;
  materialId: string;
  previousStock: number;
  newStock: number;
  quantityAdded: number;
}> {
  const supabase = createClient();

  if (!input.materialId) {
    throw new Error("Material selecionado é obrigatório.");
  }
  if (!input.quantity || input.quantity <= 0) {
    throw new Error("Quantidade de entrada deve ser maior que zero.");
  }

  const { data, error } = await supabase.rpc("register_stock_entry", {
    p_material_id: input.materialId,
    p_quantity: input.quantity,
    p_batch: input.batch?.trim() || null,
    p_expiration_date: input.expirationDate || null,
    p_document_reference: input.documentReference?.trim() || null,
    p_observation: input.observation?.trim() || null,
  });

  if (error || !data) {
    console.error("[registerStockEntry] Erro ao registrar entrada no Supabase:", error);
    throw new Error(`Erro ao registrar entrada de estoque: ${error?.message}`);
  }

  const res = data as {
    movement_id: string;
    material_id: string;
    previous_stock: number;
    new_stock: number;
    quantity_added: number;
  };

  return {
    movementId: res.movement_id,
    materialId: res.material_id,
    previousStock: Number(res.previous_stock),
    newStock: Number(res.new_stock),
    quantityAdded: Number(res.quantity_added),
  };
}

/**
 * Carrega o histórico de movimentações de estoque de um material
 */
export async function getMaterialStockMovements(materialId: string): Promise<StockMovement[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("material_id", materialId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getMaterialStockMovements] Erro ao carregar histórico:", error);
    return [];
  }

  return (data || []).map((row: SupabaseStockMovementRow) => ({
    id: row.id,
    materialId: row.material_id,
    movementType: "entrada",
    quantity: Number(row.quantity),
    previousStock: Number(row.previous_stock),
    newStock: Number(row.new_stock),
    batch: row.batch || undefined,
    expirationDate: row.expiration_date || undefined,
    documentReference: row.document_reference || undefined,
    observation: row.observation || undefined,
    userId: row.user_id || undefined,
    createdAt: row.created_at,
  }));
}
