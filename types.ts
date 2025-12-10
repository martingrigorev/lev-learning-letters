export type LetterType = 'vowel' | 'consonant' | 'symbol';

export interface GridItem {
  id: string; // Unique instance ID (e.g., 'grid-item-A-123')
  char: string;
}

// Map cell index (0-159) to a GridItem
export type GridState = Record<number, GridItem>;

export interface DragData {
  origin: 'keyboard' | 'grid';
  char: string;
  id?: string; // Only present if moving from grid
  index?: number; // Only present if moving from grid
}