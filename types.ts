
export enum PCPartStatus {
  MISSING = 'MISSING',
  FOUND = 'FOUND',
  INSTALLED = 'INSTALLED'
}

export interface PCPart {
  id: string;
  name: string;
  description: string;
  location: string;
  status: PCPartStatus;
  order: number;
}

export interface GameLocation {
  id: string;
  name: string;
  horrorLevel: number;
  description: string;
  imageUrl: string;
  hasMonster?: boolean;
}

export interface LoreEntry {
  id: string;
  title: string;
  content: string;
  category: 'Monster' | 'Setting' | 'Item' | 'Combat';
}

export type DiagnosticStatus = 'OPTIMAL' | 'DEGRADED' | 'CRITICAL';

export interface DiagnosticMetric {
  id: string;
  label: string;
  value: number;
  unit: string;
  status: DiagnosticStatus;
}

export interface Item {
  id: string;
  name: string;
  type: 'FOOD' | 'DRINK' | 'WEAPON' | 'UTILITY';
  value: number; // Heal amount, stamina amount, or damage
  description: string;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  scrap: number;
  inventory: Item[];
  equippedWeapon: Item | null;
}

export interface SectorStatus {
  id: string;
  salvageLeft: number;
  aggression: number;
}
