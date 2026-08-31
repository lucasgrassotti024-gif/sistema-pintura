import React from "react";
import { ActivityConsumption } from "../types/activity.types";

interface ActivityConsumptionLogProps {
  consumptions?: ActivityConsumption[];
}

export function ActivityConsumptionLog({ consumptions = [] }: ActivityConsumptionLogProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-800">Consumo Real Apontado</h4>
      {consumptions.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum consumo apontado.</p>
      ) : (
        <ul className="divide-y border rounded bg-white">
          {consumptions.map((c) => (
            <li key={c.id} className="p-3 text-sm flex justify-between">
              <span>{c.materialName}</span>
              <span className="font-medium">{c.quantity} {c.unit}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
