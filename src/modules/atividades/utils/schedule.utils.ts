import { Activity } from "../types/activity.types";
import { formatDateISO } from "./week.utils";

export interface MonthDayInfo {
  date: string; // YYYY-MM-DD
  dayNumber: number; // 1 a 31
  isCurrentMonth: boolean;
  isToday: boolean;
  dayOfWeek: string; // Seg, Ter, Qua, etc.
}

export interface MonthInfo {
  year: number;
  month: number; // 0-indexed (0 = Jan, 8 = Set)
  monthName: string; // "Setembro"
  label: string; // "Setembro de 2026"
  days: MonthDayInfo[];
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const DAY_ABBRS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/**
 * Calcula a diferença em dias corridos entre duas datas YYYY-MM-DD.
 * Preserva estritamente a duração usada pelo sistema.
 * Ex: 2026-09-09 a 2026-09-09 = 0 dias de intervalo (duração 1 dia).
 * Ex: 2026-09-09 a 2026-09-11 = 2 dias de intervalo (duração 3 dias).
 */
export function calculateDaysDifference(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(`${startDateStr}T00:00:00`);
  const end = new Date(`${endDateStr}T00:00:00`);
  const diffTime = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * Adiciona um número de dias a uma data YYYY-MM-DD e retorna no formato YYYY-MM-DD.
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatDateISO(d);
}

/**
 * Calcula as novas datas planejadas ao mover uma atividade para um dia de destino.
 * Preserva rigorosamente a duração original da atividade:
 * se durava 3 dias (diff de 2 dias entre start e end), continua durando 3 dias a partir da nova data.
 */
export function calculateRescheduledDates(
  currentStart: string,
  currentEnd: string,
  targetDayStr: string
): { newStartDate: string; newEndDate: string; durationDays: number } {
  const diffDays = calculateDaysDifference(currentStart, currentEnd);
  const newStartDate = targetDayStr;
  const newEndDate = addDaysToDate(targetDayStr, diffDays);

  return {
    newStartDate,
    newEndDate,
    durationDays: diffDays + 1,
  };
}

/**
 * Constrói a grade completa do calendário mensal para exibição (7 colunas: Segunda a Domingo).
 * Inclui os dias do final do mês anterior e início do mês seguinte para completar as semanas.
 */
export function getMonthCalendarGrid(referenceDate: Date = new Date()): MonthInfo {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const todayISO = formatDateISO(new Date());

  // Primeiro dia do mês
  const firstDay = new Date(year, month, 1);
  // Último dia do mês
  const lastDay = new Date(year, month + 1, 0);

  // Dia da semana do primeiro dia (0 = Dom, 1 = Seg, ..., 6 = Sáb)
  // Ajuste para padrão Brasil (Segunda = 0, ..., Domingo = 6)
  let firstDayOfWeek = firstDay.getDay() - 1;
  if (firstDayOfWeek === -1) firstDayOfWeek = 6;

  const days: MonthDayInfo[] = [];

  // Dias do mês anterior para preencher a primeira semana
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const prevDate = new Date(year, month - 1, dayNum);
    const dateStr = formatDateISO(prevDate);
    const dayOfWeekIdx = (prevDate.getDay() + 6) % 7;

    days.push({
      date: dateStr,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: dateStr === todayISO,
      dayOfWeek: DAY_ABBRS[dayOfWeekIdx],
    });
  }

  // Dias do mês atual
  for (let dayNum = 1; dayNum <= lastDay.getDate(); dayNum++) {
    const currDate = new Date(year, month, dayNum);
    const dateStr = formatDateISO(currDate);
    const dayOfWeekIdx = (currDate.getDay() + 6) % 7;

    days.push({
      date: dateStr,
      dayNumber: dayNum,
      isCurrentMonth: true,
      isToday: dateStr === todayISO,
      dayOfWeek: DAY_ABBRS[dayOfWeekIdx],
    });
  }

  // Dias do próximo mês para fechar a última linha da grade (múltiplo de 7)
  const remaining = (7 - (days.length % 7)) % 7;
  for (let dayNum = 1; dayNum <= remaining; dayNum++) {
    const nextDate = new Date(year, month + 1, dayNum);
    const dateStr = formatDateISO(nextDate);
    const dayOfWeekIdx = (nextDate.getDay() + 6) % 7;

    days.push({
      date: dateStr,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: dateStr === todayISO,
      dayOfWeek: DAY_ABBRS[dayOfWeekIdx],
    });
  }

  return {
    year,
    month,
    monthName: MONTH_NAMES[month],
    label: `${MONTH_NAMES[month]} de ${year}`,
    days,
  };
}

/**
 * Retorna as atividades que interceptam o dia especificado, considerando overrides pendentes locais.
 */
export function getActivitiesForDayWithPending(
  activities: Activity[],
  dayStr: string,
  pendingChanges: Map<string, { newStartDate: string; newEndDate: string }>
): Activity[] {
  return activities.filter((act) => {
    const pending = pendingChanges.get(act.id);
    const start = pending ? pending.newStartDate : act.schedule.plannedStartDate;
    const end = pending ? pending.newEndDate : act.schedule.plannedEndDate;

    return start <= dayStr && end >= dayStr;
  });
}
