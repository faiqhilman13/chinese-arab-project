export type ImmersionPhaseCode = "phase_1" | "phase_2" | "phase_3" | "phase_4";
export type ImmersionModeApi = "input" | "output" | "study" | "tutor";

export type ImmersionPhaseConfig = {
  code: ImmersionPhaseCode;
  label: string;
  fromDay: number;
  toDay: number;
  ratio: Record<ImmersionModeApi, number>;
};

export const ARABIC_DAILY_TARGET_MINUTES = 360;

export const ARABIC_PHASES: ImmersionPhaseConfig[] = [
  {
    code: "phase_1",
    label: "Foundation (Months 0-3)",
    fromDay: 1,
    toDay: 90,
    ratio: { input: 0.8, output: 0.1, study: 0.1, tutor: 0 },
  },
  {
    code: "phase_2",
    label: "Accumulation (Months 4-6)",
    fromDay: 91,
    toDay: 180,
    ratio: { input: 0.65, output: 0.2, study: 0.15, tutor: 0 },
  },
  {
    code: "phase_3",
    label: "Activation (Months 7-9)",
    fromDay: 181,
    toDay: 270,
    ratio: { input: 0.5, output: 0.35, study: 0.15, tutor: 0 },
  },
  {
    code: "phase_4",
    label: "Refinement (Months 10-12)",
    fromDay: 271,
    toDay: 3650,
    ratio: { input: 0.45, output: 0.4, study: 0.15, tutor: 0 },
  },
];

export function clampArabicPhaseDay(day: number): number {
  if (!Number.isFinite(day) || day < 1) {
    return 1;
  }
  return Math.floor(day);
}

export function getArabicPhase(day: number): ImmersionPhaseConfig {
  const safeDay = clampArabicPhaseDay(day);
  return ARABIC_PHASES.find((phase) => safeDay >= phase.fromDay && safeDay <= phase.toDay) ?? ARABIC_PHASES[3];
}

export function dayNumberFromStart(startDate: Date, now = new Date()): number {
  const millis = now.getTime() - startDate.getTime();
  if (millis <= 0) {
    return 1;
  }
  return Math.floor(millis / (24 * 60 * 60 * 1000)) + 1;
}

export function ratioAdherenceScore(
  actual: Record<ImmersionModeApi, number>,
  target: Record<ImmersionModeApi, number>,
): number {
  const actualTotal = Object.values(actual).reduce((sum, value) => sum + value, 0);
  if (actualTotal <= 0) {
    return 0;
  }

  let deviation = 0;
  for (const mode of Object.keys(target) as ImmersionModeApi[]) {
    const actualShare = actual[mode] / actualTotal;
    deviation += Math.abs(actualShare - target[mode]);
  }

  const normalized = Math.max(0, 1 - deviation / 2);
  return Math.round(normalized * 100);
}
