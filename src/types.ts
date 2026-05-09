export interface LifeEvent {
  type: string;
  date?: string;
  place?: string;
  description?: string;
  notes?: string[];
  sources?: string[];
}

export interface PersonDetail {
  id: string;
  events: LifeEvent[];
  notes: string[];
}

export interface Person {
  id: string;
  name: string;
  givenName?: string;
  surname?: string;
  sex: 'M' | 'F' | 'U';
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  fatherIds: string[];
  motherIds: string[];
  childIds: string[];
  spouseIds: string[];
}

export interface TreeNode extends Person {
  generation: number;
  role?: 'root' | 'sibling' | 'spouse';
  x: number;
  y: number;
}
