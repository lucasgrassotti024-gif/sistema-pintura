import { MaterialStockStatus } from "../types/material.types";

export function calculateStockStatus(currentStock: number, minimumStock: number): MaterialStockStatus {
  if (currentStock < minimumStock) {
    return "critico";
  }
  if (currentStock <= minimumStock * 1.15) {
    return "atencao";
  }
  return "adequado";
}
