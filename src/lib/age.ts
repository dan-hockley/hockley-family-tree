import type { Person } from '../types';

function extractYear(date: string | undefined): number | null {
  if (!date) return null;
  const m = date.match(/\d{4}/);
  return m ? parseInt(m[0], 10) : null;
}

export interface Age {
  value: number;
  isLiving: boolean;
}

export function computeAge(person: Person): Age | null {
  const birth = extractYear(person.birthDate);
  if (birth == null) return null;
  const death = extractYear(person.deathDate);
  if (death != null) {
    return { value: Math.max(0, death - birth), isLiving: false };
  }
  const now = new Date().getFullYear();
  const value = now - birth;
  if (value < 0 || value > 110) return null;
  return { value, isLiving: true };
}
