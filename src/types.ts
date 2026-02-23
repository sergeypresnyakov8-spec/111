export interface User {
  id: string | number;
  name: string;
  password?: string;
}

export interface UserCredentials {
  name: string;
  id: string | number;
}

export type ShiftType = 'DAY' | 'NIGHT';

export interface Shift {
  day: number;
  type: ShiftType;
  hours: number;
  isExtra: boolean;
  time: string;
  label: string;
}

export interface Rates {
  day: number;
  night: number;
}

export type TabPeriod = 'first' | 'second';
