
export const OPERATORS = ['+', '-', '*', '/', '%', '(', ')'];
export const COMPARISON = ['<', '>', '<=', '>=', '==', '!='];
export const LOGICAL = ['&&', '||'];

export function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function decodeHtmlEntities(text) {
  if (!text) return '';
  const entities = {
    '&gt;': '>', '&lt;': '<', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ',
    '&ge;': '>=', '&le;': '<=', '&ne;': '!=', '&equals;': '=', '&plus;': '+', '&minus;': '-',
    '&times;': '*', '&divide;': '/', '&percnt;': '%', '&lpar;': '(', '&rpar;': ')',
  };
  let decoded = text;
  Object.keys(entities).forEach((e) => { decoded = decoded.replace(new RegExp(e, 'g'), entities[e]); });
  decoded = decoded.replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec));
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
  return decoded;
}

export function formulaFields(json) {
  const form = (json.components || []).filter((c) => c.type === 'number').map((c) => ({
    key: `c:${c.id}`, id: c.id, label: c.label, context: 'form',
  }));
  const sections = (json.sections || []).map((s) => ({
    tableId: s.tableId,
    tableHeader: s.tableHeader,
    fields: (s.tableColumns || []).filter((col) => col.inputType === 'number').map((col) => ({
      key: `s:${s.tableId}:${col.columnHeader}`, id: col.id, label: col.columnHeader,
      fullName: `${col.columnHeader} [${s.tableHeader}]`, section: s.tableHeader, context: 'section',
    })),
  }));
  return { form, sections };
}


export function existingFormulas(json) {
  const form = (json.components || [])
    .filter((c) => c.formula && String(c.formula).trim() !== '')
    .map((c) => ({ ...c, kind: 'form-field', uiKey: `c:${c.id}`, formulaId: c.id || `form_${c.key}`, section: '' }));
  const sec = [];
  (json.sections || []).forEach((s) => {
    (s.tableColumns || []).filter((col) => col.formula && String(col.formula).trim() !== '').forEach((col) => {
      sec.push({
        ...col, kind: 'section-field', section: s.tableHeader, tableId: s.tableId, label: col.columnHeader,
        uiKey: `s:${s.tableId}:${col.columnHeader}`, formulaId: col.id || `section_${s.tableHeader}_${col.key}`,
      });
    });
  });
  return [...form, ...sec];
}

export function splitAtResult(formula) {
  const f = formula || '';
  for (let i = 0; i < f.length; i++) {
    if (f[i] !== '=') continue;
    const prev = f[i - 1];
    const next = f[i + 1];
    if (next === '=' || prev === '=' || prev === '<' || prev === '>' || prev === '!') continue;
    return { leftSide: f.slice(0, i).trim(), rightSide: f.slice(i + 1).trim(), hasEquals: true };
  }
  return { leftSide: f.trim(), rightSide: '', hasEquals: false };
}

export function extractAllFieldsFromFormula(formula, availableLabels, sections) {
  const fields = new Set();
  const parts = formula.split('=');
  if (parts.length < 2) return [];
  const expression = parts.slice(1).join('=').trim();
  const tokens = expression.split(/([+\-*/%=()]|&&|\|\||==|!=|<=|>=|<|>)/);
  tokens.forEach((token) => {
    const t = token.trim();
    if (t && /^[a-zA-Z]/.test(t)) {
      let name = t;
      if (name.includes('(')) name = name.split('(')[0].trim();
      if (!/^\d+$/.test(name)) {
        const isForm = availableLabels.some((f) => f.toLowerCase() === name.toLowerCase());
        const isSection = (sections || []).some((s) =>
          (s.tableColumns || []).some((c) => c.columnHeader.toLowerCase() === name.toLowerCase() && c.inputType === 'number'));
        if (isForm || isSection) fields.add(name);
      }
    }
  });
  return Array.from(fields);
}



const isFieldToken = (v) => /^[a-zA-Z]/.test(v);

export function appendToFormula(current, value, result) {
  if (!result || !result.name) return { error: 'Please select a result field first' };
  const { hasEquals, rightSide } = splitAtResult(current);

  if (value === '=') {
    if (!hasEquals) return { text: `${result.name} = ` };

    if (/[<>!=]$/.test(current) && !/(<=|>=|!=|==)$/.test(current) && rightSide !== '') return { text: current + '=' };

    if (/[a-zA-Z0-9)]$/.test(current) && rightSide !== '') return { text: current + '=' };
    return { error: 'Formula can contain only one =' };
  }
  if ((value === '&' || value === '|') && hasEquals) {
    const last = current.slice(-1);
    if (last === value && !current.endsWith(value + value)) return { text: current + value };
    if (rightSide === '' || /[+\-*/%(<>=&|!]$/.test(current)) return { error: 'Logical operator must follow a value' };
    return { text: current + value };
  }
  if (!hasEquals) return { text: `${result.name} = ${value}` };


  let v = value;
  if (v.includes('[') && v.includes(']')) v = v.split('[')[0].trim();

  const expr = rightSide;
  const lastChar = expr.slice(-1);

  if (isFieldToken(v) && expr !== '' && /[a-zA-Z0-9)]$/.test(lastChar)) {
    return { error: 'Need an operator between fields' };
  }
  if (/^\d$/.test(v) && expr !== '' && /\d$/.test(lastChar)) {
    const tokens = expr.split(/([+\-*/%()]|&&|\|\||==|!=|<=|>=|<|>)/);
    if (/^[a-zA-Z]/.test(tokens[tokens.length - 1].trim())) return { error: 'Need an operator between field and number' };
  }
  if (v === '.' && (expr === '' || !/\d$/.test(lastChar))) return { error: 'Decimal point must follow a number' };
  if (v === ')') {
    const open = (current.match(/\(/g) || []).length;
    const close = (current.match(/\)/g) || []).length;
    if (close >= open) return { error: 'No opening parenthesis to close' };
  }
  return { text: current + v };
}


export function backspace(current, availableLabels, result) {
  const prefix = result && result.name ? `${result.name} = ` : '';
  if (!current || current.length <= prefix.length) return current;
  if (/(&&|\|\||==|!=|<=|>=)$/.test(current)) return current.slice(0, -2);
  const lastChar = current.slice(-1);
  if (/[a-zA-Z0-9]/.test(lastChar)) {
    let i = current.length - 1;
    while (i >= prefix.length && /[a-zA-Z0-9\s]/.test(current[i])) i--;
    const start = i + 1;
    const candidate = current.substring(start).trim();
    if (availableLabels.some((f) => f === candidate)) return current.substring(0, start);
  }
  return current.slice(0, -1);
}


export function validateFormula(formula) {
  const f = (formula || '').trim();
  if (!f) return { valid: true, message: '' };
  const { rightSide, hasEquals } = splitAtResult(f);
  let valid = true;
  let message = '';

  if (!hasEquals) { valid = false; message = "Formula must contain '=' operator"; }
  else if (!rightSide.trim()) { valid = false; message = 'Formula expression cannot be empty'; }

  if (valid && rightSide.trim()) {
    const patterns = ['>=', '<=', '>', '<', '==', '!='].map((op) =>
      new RegExp(`([a-zA-Z][a-zA-Z0-9\\s]*)\\s*(${op})\\s*([a-zA-Z][a-zA-Z0-9\\s]*)`));
    const pureComparison = patterns.some((p) => p.test(rightSide));
    const hasArithmetic = /[+\-*/%]/.test(rightSide);
    const hasLogical = /&&|\|\|/.test(rightSide);
    if (pureComparison && !hasArithmetic && !hasLogical) {
      const count = (rightSide.match(/>=|<=|==|!=|>|</g) || []).length;
      if (count !== 1) { valid = false; message = 'Comparison formula should have exactly one comparison operator'; }
    } else if (hasArithmetic || hasLogical) {
      const tokens = rightSide.split(/([+\-*/%()]|&&|\|\||==|!=|<=|>=|<|>)/).filter((t) => t.trim());
      for (let i = 1; i < tokens.length; i++) {
        if (/^[a-zA-Z0-9.]/.test(tokens[i].trim()) && /^[a-zA-Z0-9.]/.test(tokens[i - 1].trim())) {
          valid = false; message = 'Fields/numbers must be separated by operators'; break;
        }
      }
    }
  }
  if (valid && /=/.test(rightSide.replace(/==|!=|<=|>=/g, ''))) { valid = false; message = 'Use == to compare values'; }

  const open = (f.match(/\(/g) || []).length;
  const close = (f.match(/\)/g) || []).length;
  if (open !== close) { valid = false; message = 'Unmatched parentheses in formula'; }

  if (hasEquals && rightSide && /[+\-*/%&|<>=]$/.test(f)) { valid = false; message = 'Formula cannot end with an operator'; }
  return { valid, message };
}



const PREC = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };

function tokenize(expr) {
  const out = [];
  const re = /\s*(\d+(?:\.\d+)?|\.\d+|&&|\|\||==|!=|<=|>=|[-+*/%()<>])/y;
  let pos = 0;
  while (pos < expr.length) {
    re.lastIndex = pos;
    const m = re.exec(expr);
    if (!m) {
      if (/^\s*$/.test(expr.slice(pos))) break;
      throw new Error(`Unexpected "${expr.slice(pos).trim().slice(0, 12)}"`);
    }
    out.push(m[1]);
    pos = re.lastIndex;
  }
  return out;
}

export function evaluate(expr) {
  const tokens = tokenize(expr);
  const output = [];
  const ops = [];
  let prevWasValue = false;
  const apply = () => {
    const op = ops.pop();
    if (op === 'neg') { output.push(-output.pop()); return; }
    const b = output.pop();
    const a = output.pop();
    if (a === undefined || b === undefined) throw new Error('Incomplete expression');
    switch (op) {
      case '+': output.push(a + b); break;
      case '-': output.push(a - b); break;
      case '*': output.push(a * b); break;
      case '/': output.push(a / b); break;
      case '%': output.push(a % b); break;
      case '<': output.push(a < b); break;
      case '>': output.push(a > b); break;
      case '<=': output.push(a <= b); break;
      case '>=': output.push(a >= b); break;
      case '==': output.push(a === b); break;
      case '!=': output.push(a !== b); break;
      case '&&': output.push(Boolean(a && b)); break;
      case '||': output.push(Boolean(a || b)); break;
      default: throw new Error(`Unknown operator ${op}`);
    }
  };
  for (const t of tokens) {
    if (/^[\d.]/.test(t)) { output.push(parseFloat(t)); prevWasValue = true; }
    else if (t === '(') { ops.push(t); prevWasValue = false; }
    else if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') apply();
      if (!ops.length) throw new Error('Unmatched )');
      ops.pop();
      prevWasValue = true;
    } else if (t === '-' && !prevWasValue) { ops.push('neg'); }
    else {
      while (ops.length && ops[ops.length - 1] !== '(' &&
        (ops[ops.length - 1] === 'neg' || PREC[ops[ops.length - 1]] >= PREC[t])) apply();
      ops.push(t);
      prevWasValue = false;
    }
  }
  while (ops.length) {
    if (ops[ops.length - 1] === '(') throw new Error('Unmatched (');
    apply();
  }
  if (output.length !== 1) throw new Error('Invalid expression');
  return output[0];
}


export function calculate(formula, values) {
  const { rightSide } = splitAtResult(formula);
  let expr = rightSide;
  Object.keys(values).sort((a, b) => b.length - a.length).forEach((name) => {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expr = expr.replace(new RegExp(`(^|[^A-Za-z0-9_])${esc}(?=$|[^A-Za-z0-9_])`, 'g'), `$1(${values[name]})`);
  });
  if (/[a-zA-Z]/.test(expr)) throw new Error('Enter a value for every field');
  return evaluate(expr);
}

export const isComparisonFormula = (formula) => /[<>]=?|==|!=/.test(splitAtResult(formula).rightSide);

export const roundResult = (n) => Math.round(n * 1000) / 1000;


export function formulaRule(saved) {
  const formula = decodeHtmlEntities(saved || '').trim();
  if (!formula) return null;
  const { leftSide, rightSide, hasEquals } = splitAtResult(formula);
  if (!hasEquals || !rightSide) return null;
  const isComparison = /(>=|<=|==|!=|>|<)/.test(rightSide);
  return { formula, result: leftSide, expression: rightSide, isComparison, isCalculation: !isComparison };
}


export function labelsInExpression(expression, labels) {
  let rest = ` ${expression} `;
  const found = [];
  [...labels].sort((a, b) => b.length - a.length).forEach((label) => {
    if (!label) return;
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^A-Za-z0-9_])${esc}(?=$|[^A-Za-z0-9_])`, 'gi');
    if (re.test(rest)) {
      found.push(label);
      rest = rest.replace(new RegExp(`(^|[^A-Za-z0-9_])${esc}(?=$|[^A-Za-z0-9_])`, 'gi'), '$1 ');
    }
  });
  return found;
}

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';


export function evaluateRule(rule, valueByLabel) {
  const labels = Object.keys(valueByLabel);
  const used = labelsInExpression(rule.expression, labels);
  const missing = used.filter((l) => isBlank(valueByLabel[l]) || Number.isNaN(Number(valueByLabel[l])));
  if (missing.length) return { status: 'missing', missing };
  let expr = ` ${rule.expression} `;
  used.forEach((label) => {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expr = expr.replace(new RegExp(`(^|[^A-Za-z0-9_])${esc}(?=$|[^A-Za-z0-9_])`, 'gi'), `$1(${Number(valueByLabel[label])})`);
  });
  if (/[a-zA-Z]/.test(expr)) {
    const unknown = (expr.match(/[A-Za-z][A-Za-z0-9 _]*/g) || []).map((s) => s.trim());
    return { status: 'error', message: `Unknown field: ${unknown[0]}` };
  }
  try {
    const value = evaluate(expr.trim());
    if (typeof value === 'number' && !Number.isFinite(value)) return { status: 'error', message: 'Result is not a number' };
    return { status: 'ok', value };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

export function applyFormulas(fields, values) {
  const rules = {};
  fields.forEach((f) => { const r = formulaRule(f.formula); if (r) rules[f.key] = r; });
  const out = { ...values };
  const calc = {};
  const cond = {};

  const byLabel = () => {
    const m = {};
    fields.forEach((f) => { if (f.label) m[f.label] = out[f.key]; });
    return m;
  };


  Object.keys(rules).forEach((k) => { if (rules[k].isCalculation) out[k] = ''; });
  for (let pass = 0; pass <= fields.length; pass++) {
    let changed = false;
    Object.keys(rules).forEach((k) => {
      if (!rules[k].isCalculation) return;
      const r = evaluateRule(rules[k], byLabel());
      let v = '';
      if (r.status === 'ok') v = typeof r.value === 'boolean' ? (r.value ? 1 : 0) : roundResult(r.value);
      const next = v === '' ? '' : String(v);
      if (out[k] !== next) { out[k] = next; changed = true; }
      calc[k] = r;
    });
    if (!changed) break;
  }

  Object.keys(rules).forEach((k) => {
    if (!rules[k].isComparison) return;
    const r = evaluateRule(rules[k], byLabel());
    cond[k] = r.status === 'ok'
      ? { ok: Boolean(r.value), formula: rules[k].formula }
      : { ok: null, formula: rules[k].formula, missing: r.missing || [], message: r.message };
  });
  return { values: out, calc, cond, rules };
}
