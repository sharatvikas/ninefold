/**
 * Curios: small things hidden around town, found by walking over them.
 * The first side quest of the open world: each one tells a short, true story about the job.
 */
export interface Curio {
  id: string;
  name: string;
  /** Tile it sits on (must be walkable). */
  x: number;
  y: number;
  story: string;
}

export const CURIOS: Curio[] = [
  { id: 'duck', name: 'Rubber duck', x: 26, y: 10, story: 'Rubber duck debugging: explain your problem out loud, line by line, to a duck. Halfway through, you often spot the bug yourself.' },
  { id: 'moth', name: 'Moth in a jar', x: 10, y: 20, story: 'In 1947, engineers found a real moth stuck inside the Harvard Mark II computer. They taped it into the logbook: "first actual case of bug being found".' },
  { id: 'pager', name: 'Old pager', x: 37, y: 11, story: 'On-call engineers once carried pagers that beeped when something broke. The pagers are gone, but people still say "I got paged".' },
  { id: 'key', name: 'Lost key', x: 2, y: 21, story: 'Never put passwords or keys in code or in chat. Bots scan public code for leaked keys within minutes of it being pushed.' },
  { id: 'floppy', name: 'Floppy disk', x: 23, y: 8, story: "A backup you've never tried to restore is only a hope. Good teams practise restoring, so they know their backups really work." },
  { id: 'letter', name: 'Lost letter', x: 9, y: 13, story: "DNS is the internet's address book: it turns names like bakery.town into the number addresses computers actually use." },
  { id: 'ticket', name: 'Train ticket stub', x: 3, y: 4, story: "Small, frequent releases are safer than big, rare ones: when something breaks, there's much less to look through." },
  { id: 'bottle', name: 'Message in a bottle', x: 26, y: 25, story: 'Software containers work like shipping containers: the app is packed with everything it needs, so it runs the same anywhere.' },
];

export const CURIO_IDS = new Set(CURIOS.map((c) => c.id));

/** The curio whose tile the point (in pixels) is standing on, if not found yet. */
export function curioAt(px: number, py: number, found: readonly string[], tile: number): Curio | undefined {
  return CURIOS.find((c) => !found.includes(c.id) && Math.abs(px - (c.x + 0.5) * tile) < 8 && Math.abs(py - (c.y + 0.5) * tile) < 8);
}
