declare module 'timetables' {
  type TimetableOptions = {
    el: string;
    timetables: string[][];
    week: string[];
    timetableType: Array<[string | { index: string; name: string }, number]>;
    merge?: boolean;
    styles?: { leftHandWidth?: number; Gheight?: number; palette?: string[] | boolean };
  };

  export default class Timetables {
    constructor(options: TimetableOptions);
    setOption(options: Omit<TimetableOptions, 'el'>): void;
  }
}
