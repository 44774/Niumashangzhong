export interface DefaultTemplateInput {
  name: string;
  shortName: string;
  kind: "work" | "rest";
  color: string;
  startTime: string | null;
  endTime: string | null;
  endsNextDay: boolean;
  unpaidBreakMinutes: number;
  sortOrder: number;
}

export const DEFAULT_TEMPLATES: DefaultTemplateInput[] = [
  {
    name: "早班",
    shortName: "早班",
    kind: "work",
    color: "#10B981",
    startTime: "09:00",
    endTime: "17:30",
    endsNextDay: false,
    unpaidBreakMinutes: 0,
    sortOrder: 1,
  },
  {
    name: "晚班",
    shortName: "晚班",
    kind: "work",
    color: "#2F80ED",
    startTime: "13:00",
    endTime: "21:30",
    endsNextDay: false,
    unpaidBreakMinutes: 0,
    sortOrder: 2,
  },
  {
    name: "夜班",
    shortName: "夜班",
    kind: "work",
    color: "#7C3AED",
    startTime: "21:00",
    endTime: "07:00",
    endsNextDay: true,
    unpaidBreakMinutes: 0,
    sortOrder: 3,
  },
  {
    name: "休息",
    shortName: "休",
    kind: "rest",
    color: "#94A3B8",
    startTime: null,
    endTime: null,
    endsNextDay: false,
    unpaidBreakMinutes: 0,
    sortOrder: 4,
  },
];
