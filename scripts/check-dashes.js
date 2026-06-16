#!/usr/bin/env node
/*
 * Typography guard — em/en-dash spacing.
 *
 * House rule: an em-dash (—) or en-dash (–) NEVER has spaces directly
 * around it, anywhere in user-facing HTML — neither in wordmark titles
 * ("Archive—Andrey Ubeyvolk") nor in prose ("range—an enormous library").
 *
 * Usage:
 *   node scripts/check-dashes.js          # report violations, exit 1 if any
 *   node scripts/check-dashes.js --fix    # auto-fix in place, then report
 *   node scripts/check-dashes.js <files>  # limit to given files (used by hook)
 *
 * <script>...</script> blocks are skipped so JS comments/strings are left
 * alone — the rule is about displayed content, not code.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const FIX = process.argv.includes('--fix');
// --hook: scan everything; on violations print to stderr and exit 2 so the
// Claude Code PostToolUse hook feeds the warning back to the assistant.
const HOOK = process.argv.includes('--hook');
const explicit = process.argv.slice(2).filter(a => a !== '--fix' && a !== '--hook');

// space(s) directly adjacent to an em/en dash, on either or both sides
const SPACED_DASH = /[ \t ]+([—–])|([—–])[ \t ]+/;
const SPACED_DASH_G = /[ \t ]*([—–])[ \t ]*/g;

function htmlFiles() {
  const out = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (name === 'node_modules' || name === '.git') continue;
      const fp = path.join(dir, name);
      const st = fs.statSync(fp);
      if (st.isDirectory()) walk(fp);
      else if (name.endsWith('.html')) out.push(fp);
    }
  })(root);
  return out;
}

const files = explicit.length
  ? explicit.map(f => path.resolve(f)).filter(f => f.endsWith('.html') && fs.existsSync(f))
  : htmlFiles();

let totalHits = 0;
let totalFixed = 0;

for (const fp of files) {
  const lines = fs.readFileSync(fp, 'utf8').split('\n');
  let inScript = false;
  let fileChanged = false;

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('<script')) inScript = true;
    const wasInScript = inScript;
    if (lower.includes('</script')) inScript = false;
    if (wasInScript) continue; // skip JS lines

    if (SPACED_DASH.test(lines[i])) {
      const rel = path.relative(root, fp).replace(/\\/g, '/');
      if (FIX) {
        lines[i] = lines[i].replace(SPACED_DASH_G, '$1');
        totalFixed++;
        fileChanged = true;
      } else {
        totalHits++;
        const msg = `${rel}:${i + 1}: ${lines[i].trim().slice(0, 100)}`;
        if (HOOK) process.stderr.write(msg + '\n');
        else console.log(msg);
      }
    }
  }

  if (FIX && fileChanged) fs.writeFileSync(fp, lines.join('\n'), 'utf8');
}

if (FIX) {
  console.log(totalFixed ? `Fixed ${totalFixed} line(s).` : 'Nothing to fix — already clean.');
  process.exit(0);
}

if (totalHits) {
  const summary = `\n✗ ${totalHits} spaced dash(es) found. House rule: em/en-dash takes NO surrounding spaces (titles AND prose). Fix: node scripts/check-dashes.js --fix`;
  if (HOOK) {
    process.stderr.write(summary + '\n');
    process.exit(2); // exit 2 → Claude Code feeds stderr back to the assistant
  }
  console.log(summary);
  process.exit(1);
}
if (!HOOK) console.log('✓ Dash spacing clean.');
process.exit(0);
