/**
 * Post Office 1, "Wrong Address": pure rules.
 * The sorting wall maps names to house numbers (DNS: name → IP).
 */

export type Wall = Record<string, string>;

export const RESIDENTS: Record<string, string> = { '3': 'library', '7': 'butcher', '9': 'school', '12': 'bakery' };
export const HOUSES = Object.keys(RESIDENTS);
export const NAMES = ['bakery', 'library', 'butcher', 'school'];
export const START_WALL: Wall = { bakery: '7', library: '3', butcher: '7', school: '9' };
export const CORRECT_WALL: Wall = { bakery: '12', library: '3', butcher: '7', school: '9' };

/** Accepts "bakery", " Bakery ", "bakery.town". */
export function normalizeName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.town$/, '');
}

export function lookup(wall: Wall, raw: string): string | undefined {
  return wall[normalizeName(raw)];
}

export interface Delivery {
  name: string;
  house: string | undefined; // undefined: the name isn't on the wall
  receivedBy: string | undefined;
  correct: boolean;
}

export function deliver(wall: Wall, raw: string): Delivery {
  const name = normalizeName(raw);
  const house = wall[name];
  const receivedBy = house ? RESIDENTS[house] : undefined;
  return { name, house, receivedBy, correct: !!house && receivedBy === name };
}

export function wrongEntries(wall: Wall): string[] {
  return NAMES.filter((n) => wall[n] !== CORRECT_WALL[n]);
}

/** Clean up a house number the player typed: "No. 12" → "12". Returns undefined if it isn't a house. */
export function parseHouse(raw: string): string | undefined {
  const m = raw.match(/\d+/);
  if (!m) return undefined;
  const n = String(parseInt(m[0], 10));
  return n;
}
