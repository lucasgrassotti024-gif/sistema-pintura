import { SupabaseClient } from "@supabase/supabase-js";
import { FunctionDeclaration, Type } from "@google/genai";
import { calculateStockStatus } from "@/modules/materiais/rules/material.rules";

export const inventoryDeclarations: FunctionDeclaration[] = [
  {
    name: "consultarEstoqueMateriais",
    description:
      "Consulta o catálogo técnico e o saldo físico de tintas, primers, solventes e insumos no almoxarifado. Permite filtrar por situação de estoque ('critico', 'atencao', 'adequado') ou buscar por nome/código/tipo.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        busca: {
          type: Type.STRING,
          description: "Nome, tipo ou código do material (ex: 'epóxi', 'primer', 'poliuretano', 'MAT-001').",
        },
        statusEstoque: {
          type: Type.STRING,
          description: "Situação do estoque: 'critico' (abaixo do mínimo), 'atencao' (próximo do mínimo) ou 'adequado'.",
        },
        tipo: {
          type: Type.STRING,
          description: "Categoria do material (ex: 'Tinta', 'Primer', 'Verniz', 'Solvente').",
        },
        limite: {
          type: Type.INTEGER,
          description: "Limite de registros a retornar (padrão: 20).",
        },
      },
    },
  },
];

export async function executeInventoryTool(
  toolName: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  if (toolName !== "consultarEstoqueMateriais") {
    return { erro: `Tool de estoque desconhecida: ${toolName}` };
  }

  const busca = typeof args.busca === "string" ? args.busca.trim() : "";
  const statusEstoque = typeof args.statusEstoque === "string" ? args.statusEstoque.trim().toLowerCase() : "";
  const tipo = typeof args.tipo === "string" ? args.tipo.trim() : "";
  const limite = typeof args.limite === "number" ? Math.min(args.limite, 50) : 20;

  let query = supabase
    .from("materials")
    .select("id, code, name, type, manufacturer, color, unit, current_stock, minimum_stock, location, active")
    .eq("active", true);

  if (busca) {
    query = query.or(`code.ilike.%${busca}%,name.ilike.%${busca}%,type.ilike.%${busca}%`);
  }

  if (tipo) {
    query = query.ilike("type", `%${tipo}%`);
  }

  const { data, error } = await query
    .order("current_stock", { ascending: true })
    .limit(limite);

  if (error) {
    return { erro: `Falha ao consultar estoque de materiais: ${error.message}` };
  }

  let items = (data || []).map((m: any) => {
    const cur = Number(m.current_stock || 0);
    const min = Number(m.minimum_stock || 0);
    const situacao = calculateStockStatus(cur, min);
    return {
      id: m.id,
      code: m.code,
      name: m.name,
      type: m.type,
      manufacturer: m.manufacturer || null,
      color: m.color || null,
      unit: m.unit,
      current_stock: cur,
      minimum_stock: min,
      situacao_estoque: situacao,
      location: m.location || null,
    };
  });

  if (statusEstoque) {
    items = items.filter((i) => i.situacao_estoque === statusEstoque);
  }

  return {
    total_encontrado: items.length,
    materiais: items,
  };
}
