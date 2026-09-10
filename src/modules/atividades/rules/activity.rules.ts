import { Activity, ActivityConsumption, ActivityStatus } from "../types/activity.types";

export function validateProgress(progress: number): boolean {
  return progress >= 0 && progress <= 100;
}

export function validateConsumption(consumption: Partial<ActivityConsumption>): boolean {
  if (!consumption.materialName || !consumption.quantity || consumption.quantity <= 0) {
    return false;
  }
  return true;
}

export function canEditActivity(activity: Activity): boolean {
  return activity.status !== "cancelada";
}

export function calculateStatusByProgress(newProgress: number): ActivityStatus {
  if (newProgress === 0) {
    return "programada";
  }
  if (newProgress >= 100) {
    return "concluida";
  }
  return "em_andamento";
}

export function isActivityDelayed(activity: Activity, referenceDate: string = "2026-08-23"): boolean {
  if (!activity || activity.status === "concluida" || activity.status === "cancelada") {
    return false;
  }
  const plannedEnd = activity.schedule?.plannedEndDate;
  if (!plannedEnd) {
    return false;
  }
  return plannedEnd < referenceDate;
}
