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
            'Commands for this incident:',
            ...spec.commands.map((c) => `  ${c.usage.padEnd(34)} ${c.help}`),
            '',
            'Always available:',
            '  ls                                 list files',
            '  cat <file>                         show a file',
            '  grep <text> <file>                 find lines in a file',
            '  edit <file>                        open a file in the editor',
            '  clear                              clear the screen',
          ].join('\n'),
        },
      };
    case 'ls':
      return { kind: 'output', result: { out: Object.keys(s.files).sort().join('\n') || '(no files)' } };
    case 'cat': {
      if (!arg) return out('usage: cat <file>');
      const f = s.files[arg];
      return out(f === undefined ? `cat: ${arg}: No such file` : f);
    }
    case 'grep': {
      const m = arg.match(/^(?:-i\s+)?("[^"]+"|'[^']+'|\S+)\s+(\S+)$/);
      if (!m) return out('usage: grep <text> <file>');
      const needle = m[1].replace(/^["']|["']$/g, '').toLowerCase();
      const f = s.files[m[2]];
      if (f === undefined) return out(`grep: ${m[2]}: No such file`);
      const hits = f.split('\n').filter((l) => l.toLowerCase().includes(needle));
      return out(hits.join('\n') || '(no matches)');
    }
    case 'edit':
    case 'vim':
    case 'nano':
    case 'vi': {
      if (!arg) return out(`usage: ${name} <file>`);
      if (s.files[arg] === undefined) return out(`${name}: ${arg}: No such file (use ls to see files)`);
      return { kind: 'edit', path: arg };
    }
    case 'clear':
      return { kind: 'clear' };
    default:
      return out(`${name}: command not found. Type "help" to see what you can use here.`);
  }
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
