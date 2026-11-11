/**
 * The two opening tickets. They teach the loop itself (read, find, change, verify)
 * on problems small enough to hold in your head.
 */
import { c, num, str, type Cfg, type LevelSpec } from '../spec';

// ---------------------------------------------------------------- Harbor 1 rules
/** Peak cargo of recent voyages (what the cargo chart shows). */
export const VOYAGES = [6, 9, 8, 6, 9, 7, 9, 8];
export const PEAK = Math.max(...VOYAGES);
/** Voyages sailed when a change is applied. Always includes the busiest load. */
export const TEST_VOYAGES = [8, 9, 7];
/** Above this the ship floats, but most of the hold is paid-for air. */
export const WASTEFUL_ABOVE = PEAK + 5;

export const sinks = (hold: number, crates: number): boolean => crates > hold;

// ---------------------------------------------------------------- Post 1 rules
export const RESIDENTS: Record<string, string> = { '3': 'library', '7': 'butcher', '9': 'school', '12': 'bakery' };
export const NAMES = ['bakery', 'library', 'butcher', 'school'] as const;

export interface Delivery {
  name: string;
  house: string;
  receivedBy: string | undefined;
  correct: boolean;
}

export function deliver(wall: Cfg, name: string): Delivery {
  const house = str(wall[name]);
  const receivedBy = RESIDENTS[house];
  return { name, house, receivedBy, correct: receivedBy === name };
}

const HOUSE_OPTIONS: [string, string][] = Object.keys(RESIDENTS).map((n) => [n, `No. ${n}`]);

export const STARTERS: LevelSpec[] = [
  // ------------------------------------------------------------------ Harbor 1: Sinking Ships (OOMKilled)
  {
    id: 'harbor-1',
    type: 'config',
    alert: 'SHIP-7 SANK AGAIN (×14 TODAY)',
    board: { broken: ['ship-7: sinking', 'relaunched ×14', 'deliveries late'], fixed: ['ship-7: sailing', 'relaunches: 0', 'deliveries on time'] },
    intro: {
      symptom: 'Ship-7 leaves the dock, sinks partway out, and the harbor relaunches it. Fourteen times today. Some voyages make it; most of the busy ones don\'t.',
      known: [
        'Every ship has a manifest: how big its hold is, how many crew, and what the harbor does if it sinks.',
        'A ship takes on crates as it sails. The number changes from voyage to voyage.',
        'The harbor master has been relaunching sunk ships automatically, so nobody looked closely.',
      ],
      goal: 'Find out why ship-7 sinks, change the manifest, and get three voyages home without a single relaunch.',
    },
    evidence: [
      {
        kind: 'log', id: 'log', icon: '', label: 'SHIP LOG', hint: 'What ship-7 wrote down on its last few voyages.',
        lines: [
          { t: '06:10', text: 'ship-7 launched · hold 7 crates · crew 4', note: 'Every launch starts the same way. The hold fits 7 crates.' },
          { t: '06:24', text: 'cargo 6/7 · steady', note: 'A quiet voyage. Six crates fit in a hold of seven.' },
          { t: '06:31', text: 'cargo 8/7 · HOLD OVERFLOW · ship sank', note: 'There it is. The ship took on 8 crates with room for 7. It didn\'t hit a rock; it ran out of space.', evidence: true },
          { t: '06:31', text: 'harbor: relaunching ship-7 (attempt 12)', note: 'The harbor relaunches at once. Helpful, but it also hides how often this happens.' },
          { t: '06:40', text: 'harbor: waiting 5 min before next relaunch (back-off)', note: 'Each relaunch waits a little longer than the last. That\'s the "back-off".' },
        ],
      },
      {
        kind: 'chart', id: 'cargo', icon: '', label: 'CARGO CHART', hint: 'Most crates on board during each recent voyage.', unit: ' crates',
        bars: VOYAGES.map((v, i) => ({
          label: `#${i + 1}`,
          value: v,
          note: v > 7 ? `${v} crates in a hold of 7. This voyage sank.${v === PEAK ? ` ${PEAK} is the most any voyage has carried.` : ''}` : `${v} crates. Fits in the hold, so this one made it.`,
          evidence: v === PEAK,
        })),
        limit: { value: 7, label: 'HOLD SIZE 7' },
      },
      {
        kind: 'inspect', id: 'crew', icon: '', label: 'DOCK TALK', hint: 'What people on the dock think is wrong.',
        items: [
          { title: 'Bosun', summary: '"Needs more crew."', detail: 'More crew sail the ship faster, but they don\'t make the hold any bigger. The log never mentions being short-handed.' },
          { title: 'Harbor master', summary: '"Just stop relaunching it."', detail: 'Then nothing would sink, because nothing would sail. The deliveries would stop too. That hides the problem instead of fixing it.' },
          { title: 'Loader', summary: '"Busy days are 9 crates."', detail: 'The loader has counted: the busiest voyages carry 9 crates, never more. A hold has to fit the busiest voyage, not the average one.', evidence: true },
        ],
      },
    ],
    configTitle: 'ship-7 manifest',
    fields: [
      { kind: 'number', key: 'hold', label: 'hold_size', min: 1, max: 30, unit: 'crates' },
      { kind: 'number', key: 'crew', label: 'crew', min: 1, max: 12 },
      { kind: 'choice', key: 'ifSunk', label: 'if_sunk', options: [['relaunch', 'relaunch'], ['give-up', 'give up']] },
    ],
    start: { hold: 7, crew: 4, ifSunk: 'relaunch' },
    solution: { hold: 10, crew: 4, ifSunk: 'relaunch' },
    applyLabel: 'SAIL THREE VOYAGES',
    verify: (x) => {
      const hold = num(x.hold);
      const floats = TEST_VOYAGES.every((v) => !sinks(hold, v));
      return {
        cases: [
          ...TEST_VOYAGES.map((v) => c(`voyage with ${v} crates comes home`, !sinks(hold, v))),
          c('a sunk ship would still be relaunched', x.ifSunk === 'relaunch'),
        ],
        hint: x.ifSunk !== 'relaunch'
          ? 'Giving up after a sinking means no relaunches, and no deliveries either. The symptom is gone but so is the service.'
          : hold <= 7
            ? 'The hold is the same size it was. Look at what the log says happened at the moment the ship sank.'
            : 'Better, but one voyage still overflowed. How many crates does the busiest voyage carry?',
        wasteful: floats && hold > WASTEFUL_ABOVE ? `a hold of ${hold} for a peak of ${PEAK} crates is mostly empty space the town pays for.` : undefined,
      };
    },
    recap: {
      headline: 'The ship wasn\'t unlucky. Its hold was smaller than its busiest voyage.',
      before: { lines: ['hold_size: 7', 'busiest voyage: 9 crates'], outcome: 'overflow → sinks → relaunched, 14 times' },
      after: (x) => ({ lines: [`hold_size: ${num(x.hold)}`, 'busiest voyage: 9 crates'], outcome: `${num(x.hold) - PEAK} crate(s) of headroom · 0 relaunches` }),
      why: 'A container that uses more memory than its limit is killed on the spot (OOMKilled), and Kubernetes restarts it, waiting longer each time (CrashLoopBackOff). Restarting is not a fix. Size the limit from the measured peak plus some headroom, not from the average, and not from a guess ten times too big.',
      real: `$ kubectl describe pod ship-7
  Last State:  Terminated
    Reason:    OOMKilled
  Restart Count: 14
# deployment.yaml
 resources:
   limits:
-    memory: 448Mi
+    memory: 640Mi`,
      realCaption: 'The hold is the memory limit, the crates are memory in use, and "relaunch" is the restart policy.',
    },
  },

  // ------------------------------------------------------------------ Post 1: Wrong Address (DNS A record)
  {
    id: 'post-1',
    type: 'config',
    alert: 'BAKERY MAIL AT THE WRONG DOOR',
    board: { broken: ['bakery → No. 7', 'No. 7 is the butcher', 'bread orders: lost'], fixed: ['bakery → No. 12', 'every name: right door', 'bread orders: delivered'] },
    intro: {
      symptom: 'Everything addressed to "bakery" is delivered to the butcher. The butcher is tired of bread orders. The baker has had no mail all week.',
      known: [
        'Couriers never remember addresses. They read the sorting wall: a list of names, each with a house number.',
        'Whatever the wall says, the courier does. A wrong line on the wall sends every letter for that name wrong.',
        'The wall was rewritten by hand last week.',
      ],
      goal: 'Find the wrong line on the sorting wall, correct it, and prove it with a test letter to every name.',
    },
    evidence: [
      {
        kind: 'log', id: 'deliveries', icon: '', label: 'DELIVERY LOG', hint: 'This morning\'s round.',
        lines: [
          { t: '08:02', text: 'letter for library → wall says No. 3 → signed: library', note: 'Right name, right door.' },
          { t: '08:09', text: 'letter for bakery → wall says No. 7 → signed: butcher', note: 'The courier did exactly what the wall said. The wall sent bakery mail to No. 7, and the butcher lives there.', evidence: true },
          { t: '08:15', text: 'letter for butcher → wall says No. 7 → signed: butcher', note: 'The butcher\'s own line is fine. Two names now point at No. 7.' },
          { t: '08:21', text: 'letter for school → wall says No. 9 → signed: school', note: 'Right name, right door.' },
        ],
      },
      {
        kind: 'inspect', id: 'doors', icon: '', label: 'KNOCK ON DOORS', hint: 'Walk the street and see who answers.',
        items: Object.entries(RESIDENTS).map(([n, who]) => ({
          title: `No. ${n}`,
          summary: `${who} answers`,
          detail: who === 'bakery' ? 'The baker opens the door of No. 12, flour to the elbows. "Nobody\'s written to us all week." So the bakery is here, at No. 12.' : `The ${who} lives at No. ${n}.`,
          evidence: who === 'bakery',
        })),
      },
    ],
    configTitle: 'sorting wall',
    fields: NAMES.map((n) => ({ kind: 'choice' as const, key: n, label: n, options: HOUSE_OPTIONS })),
    start: { bakery: '7', library: '3', butcher: '7', school: '9' },
    solution: { bakery: '12', library: '3', butcher: '7', school: '9' },
    applyLabel: 'SEND TEST LETTERS',
    verify: (x) => {
      const results = NAMES.map((n) => deliver(x, n));
      const bakery = results[0];
      return {
        cases: results.map((d) => c(`letter for ${d.name} → No. ${d.house} → ${d.receivedBy ?? 'nobody'}`, d.correct)),
        hint: !bakery.correct ? 'The bakery letter still reached someone else. Who actually answered the door at each house?' : 'The bakery is right now, but another name was sent to the wrong door. Only one line was wrong to begin with.',
      };
    },
    recap: {
      headline: 'Couriers were never lost. The wall told them the wrong door.',
      before: { lines: ['bakery   → No. 7', 'butcher  → No. 7'], outcome: 'bakery mail delivered to the butcher' },
      after: (x) => ({ lines: [`bakery   → No. ${str(x.bakery)}`, 'butcher  → No. 7'], outcome: 'every test letter signed for by the right name' }),
      why: 'DNS is the sorting wall of the internet: it turns a name into an address. An A record is one line of it, name → IP address. Clients do exactly what the record says, so a wrong record sends everyone to the wrong server, even though the right server is up and healthy. When "the site is down" for everybody at once, check where the name points.',
      real: `$ dig +short bakery.town
10.0.0.7          # the butcher's address
# town.zone
- bakery.town.   300  IN  A  10.0.0.7
+ bakery.town.   300  IN  A  10.0.0.12
$ dig +short bakery.town
10.0.0.12`,
      realCaption: 'The names are hostnames, the house numbers are IP addresses, and the wall is the zone file.',
    },
  },
];
