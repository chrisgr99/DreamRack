// expr.js — the Formula module's expression grammar.
//
// This is the ONLY place user text becomes shader source, so it is a whitelist and not a filter.
// Nothing is stripped or escaped: the expression is tokenised, every token must be one the
// grammar knows, and the output is rebuilt from those tokens. Text that does not parse never
// reaches the compiler at all. A filter can be got round; a whitelist cannot.
//
// The grammar is deliberately small — arithmetic, parentheses, and a handful of functions that
// are useful on a 0..1 image. It is not a way to write arbitrary GLSL, and it should not grow
// into one by accident: a real custom-shader module would be a different thing with different
// safeguards.

'use strict';

// The terms. A to D are the image inputs, K1 to K4 the knobs, X and Y the pixel's position and
// T the time in seconds — so an expression can be a source as well as a combination.
export const TERMS = ['A', 'B', 'C', 'D', 'K1', 'K2', 'K3', 'K4', 'X', 'Y', 'T'];

// Functions worth having on an image, and no others. Each is listed with how many arguments it
// takes, so a typo like `clamp(A)` is caught here with a useful message rather than by the
// driver with an unhelpful one.
export const FUNCS = {
  sin: 1, cos: 1, abs: 1, fract: 1, floor: 1, sqrt: 1, exp: 1, log: 1,
  min: 2, max: 2, mod: 2, pow: 2, step: 2, atan: 2,
  mix: 3, clamp: 3, smoothstep: 3,
};

const NUM = /^\d+(\.\d+)?/;
const NAME = /^[A-Za-z][A-Za-z0-9]*/;

// Tokenise. Anything not matched here is an error by construction — there is no "pass it
// through and hope" branch.
function tokenise(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if ('+-*/(),'.includes(c)) { out.push({ t: c }); i++; continue; }
    const rest = src.slice(i);
    let m = NUM.exec(rest);
    if (m) { out.push({ t: 'num', v: m[0] }); i += m[0].length; continue; }
    m = NAME.exec(rest);
    if (m) { out.push({ t: 'name', v: m[0] }); i += m[0].length; continue; }
    throw new Error(`unexpected character "${c}"`);
  }
  return out;
}

// A plain recursive-descent parser over the token list. It returns GLSL, but only ever by
// emitting fixed strings around tokens it has already recognised.
function parse(tokens) {
  let p = 0;
  const peek = () => tokens[p];
  const eat = (t) => { const k = tokens[p]; if (!k || k.t !== t) throw new Error(`expected "${t}"`); p++; return k; };

  function primary() {
    const k = peek();
    if (!k) throw new Error('the expression ends early');
    if (k.t === '(') { p++; const e = expr(); eat(')'); return `(${e})`; }
    if (k.t === '-') { p++; return `(-${primary()})`; }
    if (k.t === '+') { p++; return primary(); }
    if (k.t === 'num') { p++; return k.v.includes('.') ? k.v : `${k.v}.0`; }   // GLSL wants a float
    if (k.t === 'name') {
      p++;
      const name = k.v;
      if (peek() && peek().t === '(') {
        const arity = FUNCS[name];
        if (arity === undefined) throw new Error(`there is no function "${name}"`);
        p++;
        const args = [expr()];
        while (peek() && peek().t === ',') { p++; args.push(expr()); }
        eat(')');
        if (args.length !== arity) throw new Error(`"${name}" takes ${arity} argument${arity > 1 ? 's' : ''}, not ${args.length}`);
        return `${name}(${args.join(', ')})`;
      }
      const term = TERMS.find((t) => t.toUpperCase() === name.toUpperCase());
      if (!term) throw new Error(`"${name}" is not one of ${TERMS.join(', ')}`);
      return `v_${term}`;
    }
    throw new Error(`unexpected "${k.v || k.t}"`);
  }

  function unary() { return primary(); }
  function term() {
    let left = unary();
    while (peek() && (peek().t === '*' || peek().t === '/')) {
      const op = tokens[p++].t;
      const right = unary();
      // Division guarded: a zero denominator in a shader is not an exception, it is a NaN that
      // spreads silently through every later pass and shows as a black or white frame with no
      // clue why. The guard costs nothing and removes a whole class of "it just broke".
      left = op === '/' ? `(${left} / max(1e-6, abs(${right})) * sign(${right} + 1e-9))` : `(${left} * ${right})`;
    }
    return left;
  }
  function expr() {
    let left = term();
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = tokens[p++].t;
      left = `(${left} ${op} ${term()})`;
    }
    return left;
  }

  const out = expr();
  if (p !== tokens.length) throw new Error(`unexpected "${tokens[p].v || tokens[p].t}"`);
  return out;
}

// Compile an expression to a GLSL fragment, or report why it cannot be.
// Returns { ok: true, glsl, uses } or { ok: false, error }.
export function compileExpression(src) {
  const text = String(src || '').trim();
  if (!text) return { ok: false, error: 'the expression is empty' };
  if (text.length > 512) return { ok: false, error: 'the expression is too long' };
  try {
    const tokens = tokenise(text);
    const glsl = parse(tokens);
    // Which terms it actually mentions — the panel can then show at a glance which inputs matter,
    // and an unpatched input that is never used need not look like a mistake.
    const uses = TERMS.filter((t) => new RegExp(`\\bv_${t}\\b`).test(glsl));
    return { ok: true, glsl, uses };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
