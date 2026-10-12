import { cleanSource, validateSources } from './dynamicSource';


export const EMAIL_PATTERN = '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
export const PHONE_PATTERN = '^[6-9][0-9]{9}$';
export const TIME_PATTERN = '^([01][0-9]|2[0-3]):[0-5][0-9]$';

export const PATTERNS = [
  { value: '', label: 'Anything' },
  { value: '^[A-Za-z]+$', label: 'Letters only' },
  { value: '^[A-Za-z0-9]+$', label: 'Letters and numbers' },
  { value: '^[A-Za-z0-9 _-]+$', label: 'Letters, numbers, space, _ and -' },
  { value: '^[A-Za-z][A-Za-z0-9 ,._]*$', label: 'Must start with a letter' },
  { value: EMAIL_PATTERN, label: 'Email address' },
  { value: PHONE_PATTERN, label: 'Mobile number (10 digits, starts 6–9)' },
  { value: '^[0-9]+$', label: 'Whole numbers' },
  { value: '^[0-9]+(\\.[0-9]+)?$', label: 'Decimal number' },
  { value: '^-?[0-9]+(\\.[0-9]+)?$', label: 'Number (negative allowed)' },
  { value: '^[1-9][0-9]*$', label: 'Positive integer (no zero)' },
  { value: TIME_PATTERN, label: 'Time (HH:MM, 24-hour)' },
];

export const USER_GROUPS = [
  { value: '103', label: 'Department' },
  { value: '104', label: 'Bidder' },
];

export const COLUMN_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Text area' },
  { value: 'date', label: 'Date' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'dynamicDropdown', label: 'Dynamic dropdown (API)' },
  { value: 'radio', label: 'Single choice' },
  { value: 'checkbox', label: 'Multiple choice' },
  { value: 'file', label: 'File' },
];
export const CHOICE_COLUMN_TYPES = ['dropdown', 'select', 'radio', 'checkbox'];


let seq = 0;
export const uid = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`;
export const newFieldId = (prefix = 'field') => `${prefix}_${Date.now()}_${seq++}`;

export const generateObjectId = () =>
  [...Array(24)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');


export const convertToName = (title) => title.toLowerCase().replace(/ /g, '_');


export const normalizeText = (text) =>
  !text
    ? ''
    : text.toLowerCase().replace(/\*/g, '').replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');


export const columnIdFromHeader = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '_');

const clone = (o) => JSON.parse(JSON.stringify(o));

export const isFullWidth = (item) =>
  item.kind === 'section' || (item.kind === 'component' && item.comp.type === 'richtext');



export function fromSavedJson(json) {
  const comps = Array.isArray(json.components) ? json.components : [];
  const secs = Array.isArray(json.sections) ? json.sections : [];
  const cMap = new Map(comps.map((c) => [c.id, c]));
  const sMap = new Map(secs.map((s) => [s.tableId, s]));
  const used = new Set();
  const items = [];

  const pushComp = (c) => {
    const comp = clone(c);
    if (!comp.id) comp.id = newFieldId(comp.type === 'richtext' ? 'richtext' : 'field');
    items.push({ key: uid(), kind: 'component', comp });
  };
  const pushSec = (s) => items.push({ key: uid(), kind: 'section', sec: clone(s) });

  (Array.isArray(json.layoutOrder) ? json.layoutOrder : []).forEach((o) => {
    if (o.type === 'section' && sMap.has(o.id) && !used.has('s:' + o.id)) {
      used.add('s:' + o.id);
      pushSec(sMap.get(o.id));
    } else if (o.type === 'component' && cMap.has(o.id) && !used.has('c:' + o.id)) {
      used.add('c:' + o.id);
      pushComp(cMap.get(o.id));
    }
  });
  
  comps.forEach((c) => !used.has('c:' + c.id) && pushComp(c));
  secs.forEach((s) => !used.has('s:' + s.tableId) && pushSec(s));

  const layout = String(json.formLayout || '1');
  return {
    title: json.formTitle || '',
    layout: ['1', '2', '3'].includes(layout) ? layout : '3',
    items,
  };
}



const blankToNull = (v) => (v === '' || v === undefined ? null : v);

function cleanComponent(src) {
  const c = clone(src);
  c.label = String(c.label ?? '').replace(/\*/g, '').trim();
  if (c.labelStyles && !Object.keys(c.labelStyles).length) delete c.labelStyles;

  if (c.type === 'richtext') {
    c.content = c.content || '';
    delete c.required;
    return c;
  }

  c.required = c.required === 'yes' ? 'yes' : 'no';

  switch (c.type) {
    case 'text':
      c.inputType = c.inputType || 'text';
      ['minlength', 'maxlength', 'pattern'].forEach((k) => (c[k] = blankToNull(c[k])));
      if (!c.placeholder) delete c.placeholder;
      break;
    case 'textarea':
      ['minlength', 'maxlength', 'rows', 'cols', 'pattern'].forEach((k) => (c[k] = blankToNull(c[k])));
      if (!c.placeholder) delete c.placeholder;
      break;
    case 'number':
      ['min', 'max', 'step', 'pattern'].forEach((k) => (c[k] = blankToNull(c[k])));
      c.userGroupType = c.userGroupType || '103';
      break;
    case 'date':
    case 'dates':
      c.type = 'date';
      c.dateFormat = c.dateFormat || 'YYYY-MM-DD';
      c.minDate = blankToNull(c.minDate);
      c.maxDate = blankToNull(c.maxDate);
      break;
    case 'file':
      c.fileTypes = blankToNull(c.fileTypes);
      c.min = blankToNull(c.min);
      c.max = blankToNull(c.max);
      c.multiple = c.multiple === 'yes' ? 'yes' : 'no';
      
      c.minSize = c.min;
      c.maxSize = c.max;
      break;
    case 'select': {
      if (c.dataSource) {
        // options come from the API at runtime; only the placeholder is stored
        c.dataSource = cleanSource(c.dataSource);
        c.options = [{ value: '', label: c.dataSource.placeholder || '-Select-', selected: true, isPlaceholder: true }];
        break;
      }
      const real = (c.options || []).filter((o) => !o.isPlaceholder);
      c.options = [
        { value: '', label: '-Select-', selected: !real.some((o) => o.selected), isPlaceholder: true },
        ...real.map((o) => ({ ...o, value: o.value || o.label, selected: !!o.selected })),
      ];
      break;
    }
    case 'radio':
    case 'checkbox':
      c.options = (c.options || []).map((o) => {
        const opt = { value: o.value, label: o.label };
        if (o.labelStyles && Object.keys(o.labelStyles).length) opt.labelStyles = o.labelStyles;
        return { ...o, ...opt };
      });
      break;
    case 'signature':
      c.penColor = c.penColor || '#000000';
      c.height = String(c.height || '160');
      break;
    default:
      break;
  }
  return c;
}

function cleanSection(src) {
  const s = clone(src);
  s.tableHeader = String(s.tableHeader || '').trim();
  s.tableColumns = (s.tableColumns || []).map((col) => {
    const out = { ...col };
    out.columnHeader = String(col.columnHeader || '').trim();
    out.id = columnIdFromHeader(out.columnHeader);
    out.required = col.required === 'yes' ? 'yes' : 'no';
    const v = { ...(col.validations || {}) };
    Object.keys(v).forEach((k) => (v[k] === '' || v[k] == null) && delete v[k]);
    if (v.pattern) out.pattern = v.pattern;
    else delete out.pattern;
    if (Object.keys(v).length) out.validations = v;
    else delete out.validations;
    if (out.dataSource) {
      out.inputType = 'dropdown';
      out.dataSource = cleanSource(out.dataSource);
      delete out.options;
      return out;
    }
    if (CHOICE_COLUMN_TYPES.includes(out.inputType)) {
      out.options = (col.options || []).filter((o) => o.label).map((o) => ({ value: o.label, label: o.label, selected: !!o.selected }));
      if (!out.options.length) delete out.options;
    } else delete out.options;
    return out;
  });
  return s;
}

export function toSavedJson({ title, layout, items }) {
  const components = [];
  const sections = [];
  const layoutOrder = [];
  items.forEach((it) => {
    if (it.kind === 'section') {
      const s = cleanSection(it.sec);
      if (!s.tableColumns.length) return; // old code skipped empty tables
      sections.push(s);
      layoutOrder.push({ type: 'section', id: s.tableId });
    } else {
      const c = cleanComponent(it.comp);
      components.push(c);
      layoutOrder.push({ type: 'component', id: c.id });
    }
  });

  const formTitle = title.trim();
  return {
    formId: generateObjectId(),
    formTitle,
    formLayout: String(layout),
    formName: convertToName(formTitle),
    components,
    sections: sections.length > 0 ? sections : null,
    layoutOrder: layoutOrder.length > 0 ? layoutOrder : null,
    metadata: {
      savedAt: new Date().toISOString(),
      totalFields: components.length,
      totalTables: sections.length,
      version: '1.0',
    },
  };
}


export function validateTitle(value) {
  const v = String(value || '').trim();
  if (!v) return 'Form title is required';
  if (v.length < 5) return 'Form title must be at least 5 characters';
  if (v.length > 30) return 'Form title must be less than 30 characters';
  if (!/^[a-zA-Z\s\-.,'()]+$/.test(v)) return 'Form title can only contain letters, spaces, and basic punctuation';
  return '';
}

export function validateForSave({ title, department, items }) {
  const t = validateTitle(title);
  if (t) return { kind: 'title', message: t };
  if (!String(department || '').trim()) return { kind: 'simple', message: 'Please Select Department' };

  const exact = new Set();
  const normalized = new Set();
  const dups = [];
  let position = 0;
  for (const it of items) {
    if (it.kind !== 'component' || it.comp.type === 'richtext') continue;
    position++;
    const label = String(it.comp.label || '').replace(/\*/g, '').trim();
    if (!label) return { kind: 'simple', message: `Field ${position} has empty label`, key: it.key };
    const n = normalizeText(label);
    if (exact.has(label) || normalized.has(n)) dups.push({ label, index: position, key: it.key });
    exact.add(label);
    normalized.add(n);
  }
  if (dups.length) return { kind: 'duplicates', dups, key: dups[0].key };

  const headers = new Set();
  for (const it of items) {
    if (it.kind !== 'section') continue;
    const h = String(it.sec.tableHeader || '').trim();
    if (headers.has(h)) return { kind: 'table', message: `Table name "${h}" is already used.`, key: it.key };
    headers.add(h);
    for (const col of it.sec.tableColumns || []) {
      if (!String(col.columnHeader || '').trim())
        return { kind: 'simple', message: `Column header missing in table: ${h}`, key: it.key };
    }
    const colIds = new Set();
    for (const col of it.sec.tableColumns || []) {
      const id = columnIdFromHeader(col.columnHeader);
      if (colIds.has(id))
        return { kind: 'table', message: `Table "${h}" has two columns named "${col.columnHeader}".`, key: it.key };
      colIds.add(id);
    }
  }
  const ds = validateSources(items);
  if (ds) return { kind: 'simple', message: ds.message, key: ds.key };
  return null;
}

/* ---------------- helpers used by the builder ---------------- */

export function uniqueLabel(base, items, ignoreKey) {
  const taken = new Set(
    items
      .filter((i) => i.kind === 'component' && i.key !== ignoreKey)
      .map((i) => normalizeText(i.comp.label))
  );
  if (!taken.has(normalizeText(base))) return base;
  let n = 2;
  while (taken.has(normalizeText(`${base} ${n}`))) n++;
  return `${base} ${n}`;
}

export function nextTableId(items) {
  const used = new Set(items.filter((i) => i.kind === 'section').map((i) => i.sec.tableId));
  let n = 1;
  while (used.has(`Table_${n}`)) n++;
  return `Table_${n}`;
}

export function uniqueTableHeader(base, items) {
  const used = new Set(items.filter((i) => i.kind === 'section').map((i) => String(i.sec.tableHeader).trim()));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

export function duplicateItem(item, items) {
  const copy = clone(item);
  copy.key = uid();
  if (copy.kind === 'section') {
    copy.sec.tableId = nextTableId(items);
    copy.sec.tableHeader = uniqueTableHeader(copy.sec.tableHeader, items);
    return copy;
  }
  const c = copy.comp;
  c.id = newFieldId(c.type === 'richtext' ? 'richtext' : 'field');
  
  ['formula', 'formulaName', 'formulaDescription', 'dependencies'].forEach((k) => delete c[k]);
  if (c.type !== 'richtext') c.label = uniqueLabel(c.label, items);
  if (c.type === 'radio' || c.type === 'checkbox') {
    const sfx = Date.now() + '' + seq++;
    c.options = (c.options || []).map((o, i) => ({ ...o, value: `${c.type === 'radio' ? 'option' : 'checkbox'}${i + 1}-${sfx}` }));
  }
  return copy;
}

export function newChoiceValue(type, index) {
  return `${type === 'radio' ? 'option' : 'checkbox'}${index + 1}-${Date.now()}${seq++}`;
}
