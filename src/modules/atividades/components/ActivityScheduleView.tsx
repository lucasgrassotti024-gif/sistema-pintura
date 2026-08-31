import React from "react";
import { ActivitySchedule } from "../types/activity.types";

interface ActivityScheduleViewProps {
  schedule?: ActivitySchedule;
}

export function ActivityScheduleView({ schedule }: ActivityScheduleViewProps) {
  if (!schedule) {
    return <p className="text-sm text-slate-500">Sem programação cadastrada.</p>;
  }

  return (
    <div className="space-y-2 text-sm bg-slate-50 p-3 rounded border">
      <div>
        <span className="text-slate-500">Período Previsto:</span>{" "}
        <span className="font-medium text-slate-800">
          {schedule.plannedStartDate} até {schedule.plannedEndDate}
        </span>
      </div>
      {schedule.teamName && (
        <div>
          <span className="text-slate-500">Equipe:</span>{" "}
          <span className="font-medium text-slate-800">{schedule.teamName}</span>
        </div>
      )}
    </div>
  );
}
