/**
 * Utilitários para manipulação e cálculo de semanas no cronograma operacional.
 */

export interface WeekDayInfo {
  date: string; // Formato YYYY-MM-DD
  label: string; // Ex: "24/08" ou "Hoje (24/08)"
  dayOfWeek: string; // Ex: "Seg", "Ter", "Qua", "Qui", "Sex"
  isToday: boolean;
}

export interface WeekInfo {
  weekNumber: number;
  year: number;
  startDate: string; // YYYY-MM-DD (Segunda-feira)
  endDate: string; // YYYY-MM-DD (Sexta-feira ou Domingo)
  label: string; // Ex: "Semana 35 (24/08 a 28/08/2026)"
  days: WeekDayInfo[];
}

/**
 * Retorna o número da semana ISO de uma data.
 */
export function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Formata um objeto Date para YYYY-MM-DD em horário local/UTC seguro.
 */
export function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Obtém a segunda-feira da semana de uma data de referência.
 */
export function getMondayOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Ajusta para segunda-feira
  return new Date(date.setDate(diff));
}

const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/**
 * Gera as informações completas da semana (de segunda a sexta-feira por padrão operacional industrial).
 * @param referenceDate Data de referência
 * @param includeWeekend Se deve incluir sábado e domingo (padrão: false para 5 dias úteis)
 */
export function getWeekInfo(referenceDate: Date = new Date(), includeWeekend: boolean = false): WeekInfo {
  const monday = getMondayOfWeek(referenceDate);
  const todayStr = formatDateISO(new Date());
  const numDays = includeWeekend ? 7 : 5;

  const days: WeekDayInfo[] = [];

  for (let i = 0; i < numDays; i++) {
    const current = new Date(monday);
    current.setDate(monday.getDate() + i);
    const dateStr = formatDateISO(current);
    const dayOfMonth = String(current.getDate()).padStart(2, "0");
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const isToday = dateStr === todayStr;

    days.push({
      date: dateStr,
      label: isToday ? `Hoje (${dayOfMonth}/${month})` : `${dayOfMonth}/${month}`,
      dayOfWeek: DAY_NAMES[i],
      isToday,
    });
  }

  const startDate = days[0].date;
  const endDate = days[days.length - 1].date;
  const weekNumber = getISOWeekNumber(monday);
  const year = monday.getFullYear();

  const startDay = String(new Date(monday).getDate()).padStart(2, "0");
  const startMonth = String(new Date(monday).getMonth() + 1).padStart(2, "0");
  const lastDayDate = new Date(monday);
  lastDayDate.setDate(monday.getDate() + numDays - 1);
  const endDay = String(lastDayDate.getDate()).padStart(2, "0");
  const endMonth = String(lastDayDate.getMonth() + 1).padStart(2, "0");

  return {
    weekNumber,
    year,
    startDate,
    endDate,
    label: `Semana ${weekNumber} (${startDay}/${startMonth} a ${endDay}/${endMonth}/${year})`,
    days,
  };
}
