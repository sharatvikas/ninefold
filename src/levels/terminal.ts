/**
 * A tiny simulated shell for Act 3 levels. Pure: no DOM.
 * Levels supply files and commands; the shell provides help, ls, cat, grep, edit, clear.
 */

export interface TermState {
  files: Record<string, string>;
  vars: Record<string, string | number | boolean>;
}

export interface CmdResult {
  out: string;
  /** This output is evidence of the cause. */
  evidence?: boolean;
  /** This command changed the system. */
  changed?: boolean;
  /** A harmful action (costs Trust). */
  bad?: boolean;
  /** This command checks whether things work; the level's check runs after it. */
  verify?: boolean;
}

export interface CommandDef {
  /** Matched against the whole trimmed line. */
  match: RegExp;
  usage: string;
  help: string;
  run: (m: RegExpMatchArray, s: TermState) => CmdResult;
}

export interface TermSpec {
  host: string;
  motd: string;
  files: Record<string, string>;
  vars?: Record<string, string | number | boolean>;
  commands: CommandDef[];
}

export type Outcome = { kind: 'output'; result: CmdResult } | { kind: 'edit'; path: string } | { kind: 'clear' };

export function newTermState(spec: TermSpec): TermState {
  return { files: { ...spec.files }, vars: { ...(spec.vars ?? {}) } };
}

export function run(spec: TermSpec, s: TermState, raw: string): Outcome {
  const line = raw.trim();
  if (!line) return { kind: 'output', result: { out: '' } };
  for (const cmd of spec.commands) {
    const m = line.match(cmd.match);
    if (m) return { kind: 'output', result: cmd.run(m, s) };
  }
  const [name, ...rest] = line.split(/\s+/);
  const arg = rest.join(' ');
  switch (name) {
    case 'help':
      return {
        kind: 'output',
        result: {
          out: [
            'Commands for this incident (type one and press Enter):',
            ...spec.commands.flatMap((c) => [`  ${c.usage}`, `      ${c.help}`]),
            '',
            'Always available:',
            '  ls                  lists the files in this folder',
            '  cat <file>          prints a whole file so you can read it',
            '  grep <text> <file>  shows only the lines of a file that contain your text',
            '  edit <file>         opens a file so you can change it',
            '  clear               wipes the screen',
            '',
            'Tip: press the up arrow to bring back your last command.',
          ].join('\n'),
        },
      };
    case 'ls':
      return { kind: 'output', result: { out: Object.keys(s.files).sort().join('\n') || '(no files)' } };
    case 'cat': {
      if (!arg) return out('usage: cat <file>');
      const f = fileAt(s, arg);
      return out(f === undefined ? `cat: ${arg}: No such file` : f);
    }
    case 'grep': {
      const m = arg.match(/^(?:-i\s+)?("[^"]+"|'[^']+'|\S+)\s+(\S+)$/);
      if (!m) return out('usage: grep <text> <file>');
      const needle = m[1].replace(/^["']|["']$/g, '').toLowerCase();
      const f = fileAt(s, m[2]);
      if (f === undefined) return out(`grep: ${m[2]}: No such file`);
      const hits = f.split('\n').filter((l) => l.toLowerCase().includes(needle));
      return out(hits.join('\n') || '(no matches)');
    }
    case 'edit':
    case 'vim':
    case 'nano':
    case 'vi': {
      if (!arg) return out(`usage: ${name} <file>`);
      if (fileAt(s, arg) === undefined) return out(`${name}: ${arg}: No such file (use ls to see files)`);
      return { kind: 'edit', path: arg };
    }
    case 'clear':
      return { kind: 'clear' };
    default:
      return out(`${name}: command not found. Type "help" to see what you can use here.`);
  }
}

/** Only the level's own files: names like "toString" must not reach JavaScript's built-ins. */
const fileAt = (s: TermState, path: string): string | undefined => (Object.hasOwn(s.files, path) ? s.files[path] : undefined);

const BUILTIN_HELP: Record<string, string> = {
  help: 'lists the commands you can use here',
  ls: 'lists the files in this folder',
  cat: 'prints a whole file so you can read it',
  grep: 'shows only the lines of a file that contain your text',
  edit: 'opens a file so you can change it',
  vim: 'opens a file so you can change it',
  nano: 'opens a file so you can change it',
  vi: 'opens a file so you can change it',
  clear: 'wipes the screen (nothing is lost)',
};

/** A plain-English line saying what a command does, shown before its output for players new to terminals. */
export function explain(spec: TermSpec, raw: string): string | undefined {
  const line = raw.trim();
  if (!line) return undefined;
  const cmd = spec.commands.find((c) => c.match.test(line));
  if (cmd) return cmd.help;
  return BUILTIN_HELP[line.split(/\s+/)[0]];
}

/**
 * The command a handbook line shows, if it can be run as written here.
 * Accepts "cmd", "cmd: what it does", "cmd (note)" and numbered or indented lines.
 */
export function runnableIn(spec: TermSpec, line: string): string | undefined {
  const cmd = line.trim().replace(/^\d+\.\s+/, '').split(/:\s/)[0].replace(/\s+\(.*\)$/, '').trim();
  if (!cmd) return undefined;
  if (spec.commands.some((c) => c.match.test(cmd))) return cmd;
  // A template like "iam disable-key <KEYID>": the player fills in the <part> they found.
  const lt = cmd.indexOf('<');
  if (lt > 0 && /<[^<>]+>/.test(cmd) && spec.commands.some((c) => c.usage.startsWith(cmd.slice(0, lt)))) return cmd;
  const m = cmd.match(/^(?:ls|(?:cat|edit)\s+(\S+))$/);
  return m && (!m[1] || Object.hasOwn(spec.files, m[1])) ? cmd : undefined;
}

const out = (text: string): Outcome => ({ kind: 'output', result: { out: text } });

/** Save an edited file. Returns true if the content changed. */
export function saveFile(s: TermState, path: string, content: string): boolean {
  const before = s.files[path];
  s.files[path] = content.replace(/\r\n/g, '\n');
  return before !== s.files[path];
}

/** Collapse whitespace & quotes so checks tolerate formatting differences. */
export function squash(text: string): string {
  return text.replace(/["']/g, '').replace(/\s+/g, ' ').toLowerCase();
}
