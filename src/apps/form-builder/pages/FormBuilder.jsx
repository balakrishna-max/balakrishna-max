import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Icon from '../components/Icon';
import ElementPanel from '../components/ElementPanel';
import Canvas from '../components/Canvas';
import PropertiesPanel from '../components/PropertiesPanel';
import Preview from '../components/Preview';
import FormulaWorkspace from '../components/FormulaWorkspace';
import { ELEMENTS } from '../model/fieldCatalog';
import { fromSavedJson, toSavedJson, validateForSave, duplicateItem } from '../model/schema';
import { getDepartments, getFormDetails, saveForm } from '../api/dynamicFormApi';
import { existingFormulas } from '../model/formula';
import { columnsUsingField } from '../model/dynamicSource';
import { notSaved, errorDialog, savedDialog, confirmDialog, escapeHtml } from '../api/alerts';

function reducer(s, a) {
  const idx = (key) => s.items.findIndex((i) => i.key === key);
  switch (a.type) {
    case 'INIT':
      return { title: a.title, layout: a.layout, items: a.items, selectedKey: null, dirty: false };
    case 'SET_TITLE':
      return { ...s, title: a.title, dirty: true };
    case 'SET_LAYOUT':
      return { ...s, layout: a.layout, dirty: true };
    case 'SELECT':
      return { ...s, selectedKey: a.key };
    case 'INSERT': {
      const items = [...s.items];
      const at = a.index == null ? items.length : Math.max(0, Math.min(a.index, items.length));
      items.splice(at, 0, ...a.items);
      return { ...s, items, selectedKey: a.items[0].key, dirty: true };
    }
    case 'MOVE': {
      const from = idx(a.key);
      if (from < 0) return s;
      let to = Math.max(0, Math.min(a.to, s.items.length));
      if (to === from || to === from + 1) return s;
      const items = [...s.items];
      const [x] = items.splice(from, 1);
      if (to > from) to -= 1;
      items.splice(to, 0, x);
      return { ...s, items, dirty: true };
    }
    case 'REMOVE': {
      const i = idx(a.key);
      const items = s.items.filter((x) => x.key !== a.key);
      const nextSel = s.selectedKey === a.key ? (items[Math.min(i, items.length - 1)] || {}).key || null : s.selectedKey;
      return { ...s, items, selectedKey: nextSel, dirty: true };
    }
    case 'DUPLICATE': {
      const i = idx(a.key);
      const copy = duplicateItem(s.items[i], s.items);
      const items = [...s.items];
      items.splice(i + 1, 0, copy);
      return { ...s, items, selectedKey: copy.key, dirty: true };
    }
    case 'UPDATE_COMPONENT':
      return {
        ...s,
        dirty: true,
        items: s.items.map((x) => (x.key === a.key ? { ...x, comp: { ...x.comp, ...a.patch } } : x)),
      };
    case 'UPDATE_SECTION':
      return { ...s, dirty: true, items: s.items.map((x) => (x.key === a.key ? { ...x, sec: a.sec } : x)) };
    case 'TOUCH':
      return { ...s, dirty: true };
    case 'SYNC_FORMULAS': {

      const FKEYS = ['formula', 'formulaName', 'formulaDescription', 'dependencies'];
      const pick = (src) => {
        const o = {};
        FKEYS.forEach((k) => { if (k in src) o[k] = src[k]; });
        return o;
      };
      const comps = new Map((a.json.components || []).map((c) => [c.id, c]));
      const secs = new Map((a.json.sections || []).map((x) => [x.tableId, x]));
      return {
        ...s,
        items: s.items.map((it) => {
          if (it.kind === 'component' && comps.has(it.comp.id)) {
            return { ...it, comp: { ...it.comp, ...pick(comps.get(it.comp.id)) } };
          }
          if (it.kind === 'section' && secs.has(it.sec.tableId)) {
            const cols = new Map((secs.get(it.sec.tableId).tableColumns || []).map((c) => [c.columnHeader, c]));
            return {
              ...it,
              sec: {
                ...it.sec,
                tableColumns: (it.sec.tableColumns || []).map((c) => (cols.has(c.columnHeader) ? { ...c, ...pick(cols.get(c.columnHeader)) } : c)),
              },
            };
          }
          return it;
        }),
      };
    }
    case 'SAVED':
      return { ...s, dirty: false };
    default:
      return s;
  }
}


export default function FormBuilder({ mode, sourceFormId, initialLayout, onExit, onSavedOnce, config }) {
  const [state, dispatch] = useReducer(reducer, { title: '', layout: initialLayout || '1', items: [], selectedKey: null, dirty: false });
  const [loading, setLoading] = useState(mode !== 'new');
  const [loadError, setLoadError] = useState('');
  const [formId, setFormId] = useState(mode === 'edit' ? sourceFormId : '');
  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState('');
  const [view, setView] = useState('build');
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [panel, setPanel] = useState(null); // narrow screens: 'elements' | 'props'
  const dragRef = useRef(null);
  const hydrated = useRef(false);

  const savedJsonRef = useRef(null);

  useEffect(() => {
    getDepartments().then(setDepartments).catch((e) => console.error('Department list failed', e));
  }, []);

  // useEffect(() => {
  //   if (mode === 'new' || hydrated.current) return;
  //   hydrated.current = true;
  //   getFormDetails(sourceFormId)
  //     .then(({ json, department: dep }) => {
  //       const f = fromSavedJson(json);
  //       dispatch({ type: 'INIT', ...f });
  //       if (mode === 'edit') savedJsonRef.current = json;
  //       if (dep) setDepartment(dep);
  //     })
  //     .catch((e) => {
  //       console.error(e);
  //       setLoadError(e.message || 'The form could not be loaded.');
  //     })
  //     .finally(() => setLoading(false));
  // }, [mode, sourceFormId]);


    useEffect(() => {
    if (mode === 'new' || hydrated.current) return;
    hydrated.current = true;
    getFormDetails(sourceFormId)
      .then(({ json, department: dep }) => {
        const f = fromSavedJson(json);
        dispatch({ type: 'INIT', ...f });
        if (mode === 'edit') savedJsonRef.current = json;
        if (dep) setDepartment(dep);
      })
      .catch((e) => {
        console.error(e);
        setLoadError(e.message || 'The form could not be loaded.');
      })
      .finally(() => setLoading(false));
  }, [mode, sourceFormId]);


  const addElement = useCallback((key, index) => {
    const created = ELEMENTS[key].create(state.items);
    dispatch({ type: 'INSERT', items: created, index });
    setPanel(null);
  }, [state.items]);

  const selected = state.items.find((i) => i.key === state.selectedKey) || null;


  const save = async ({ quiet = false } = {}) => {
    const problem = validateForSave({ title: state.title, department, items: state.items });
    setTitleError(problem && problem.kind === 'title' ? problem.message : '');
    if (problem) {
      if (problem.key) dispatch({ type: 'SELECT', key: problem.key });
      if (problem.kind === 'title') {
        dispatch({ type: 'SELECT', key: null });
        setPanel('props');
        setView('build');
        await notSaved(problem.message);
        return null;
      }
      setView('build');
      if (problem.kind === 'duplicates') {
        await errorDialog(
          'Duplicate Field Names',
          `<div style="text-align:left"><h4>Duplicate Field Names Found:</h4><ul>${problem.dups
            .map((d) => `<li><strong>"${escapeHtml(d.label)}"</strong> (Field ${d.index})</li>`)
            .join('')}</ul><p><strong>Please rename duplicate fields to continue.</strong></p></div>`
        );
        return null;
      }
      if (problem.kind === 'table') { await errorDialog('Duplicate Table Name', escapeHtml(problem.message)); return null; }
      await notSaved(problem.message);
      return null;
    }

    const formJson = toSavedJson(state);
    setSaving(true);
    try {
      const res = await saveForm({ formJson, formName: state.title.trim(), department, formID: formId });
      const newId = res && res.formId ? String(res.formId) : formId;
      if (!newId) throw new Error('No form ID returned');
      savedJsonRef.current = formJson;
      setFormId(newId);
      dispatch({ type: 'SAVED' });
      onSavedOnce();
      if (!quiet) await savedDialog((res && res.message) || 'Form saved', newId);
      return { formId: newId, json: formJson };
    } catch (e) {
      console.error('Save failed', e, e.xhr && e.xhr.responseText);
      await notSaved('The form could not be saved. Please try again');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const exit = async () => {
    if (state.dirty && !(await confirmDialog('You have unsaved changes. Leave the builder without saving?'))) return;
    onExit();
  };


  const liveJson = useMemo(() => toSavedJson(state), [state.title, state.layout, state.items]); // eslint-disable-line react-hooks/exhaustive-deps

 
  const ensureSaved = async () => {
    if (formId && !state.dirty && savedJsonRef.current) return { formId, json: savedJsonRef.current };
    if (formId && state.dirty && !(await confirmDialog('The form has unsaved changes. Save the form now and continue?'))) return null;
    return save({ quiet: true });
  };


  const onFormulasSynced = async (sentJson, savedFormId) => {
    let serverJson = null;
    try {
      const res = await getFormDetails(savedFormId);
      serverJson = res.json;
    } catch (e) {
      console.warn('[SmartForms] Could not re-read the form after saving formulas', e);
    }
    const json = serverJson || sentJson;
    savedJsonRef.current = json;
    dispatch({ type: 'SYNC_FORMULAS', json });
    return serverJson;
  };

  
  const formulaUsage = useMemo(() => {
    const map = {};
    existingFormulas(liveJson).forEach((f) => {
      const name = f.kind === 'section-field' ? `${f.label} [${f.section}]` : f.label;
      [f.label, ...(f.dependencies || [])].forEach((l) => {
        const k = String(l).toLowerCase();
        if (!map[k]) map[k] = [];
        if (!map[k].includes(name)) map[k].push(name);
      });
    });
    return map;
  }, [liveJson]);

  
  const canvasDispatch = async (a) => {
    if (a.type === 'REMOVE') {
      const it = state.items.find((i) => i.key === a.key);
      const labels = !it ? [] : it.kind === 'component'
        ? [it.comp.label]
        : (it.sec.tableColumns || []).map((c) => c.columnHeader);
      const users = [...new Set(labels.flatMap((l) => formulaUsage[String(l || '').toLowerCase()] || []))];
      if (users.length && !(await confirmDialog(`This is used by the formula(s): ${users.join(', ')}. Delete it anyway? Those formulas will stop working.`))) return;
      if (it && it.kind === 'component') {
        const comps = state.items.filter((i) => i.kind === 'component').map((i) => i.comp);
        const direct = comps.filter((c) => c.dataSource && (c.dataSource.params || []).some((p) => p.source === 'field' && p.field === it.comp.id));
        const cols = columnsUsingField(it.comp.id, state.items.filter((i) => i.kind === 'section').map((i) => i.sec));
        const names = [...direct.map((c) => c.label), ...cols.map((x) => x.column)];
        if (names.length && !(await confirmDialog(`${names.join(', ')} ${names.length === 1 ? 'loads' : 'load'} options using this field. Delete it anyway? Fix ${names.length === 1 ? 'its' : 'their'} parameters afterwards.`))) return;
      }
    }
    dispatch(a);
    if (a.type === 'SELECT' && a.key && window.innerWidth < 1100) setPanel('props');
  };

  if (loading) {
    return <div className="dfb-state"><div className="dfb-spinner" aria-hidden="true" /><p>Loading form {sourceFormId}…</p></div>;
  }
  if (loadError) {
    return (
      <div className="dfb-state">
        <p className="dfb-error">Form {sourceFormId} could not be opened: {loadError}</p>
        <input type="button" className="Button" value="Back to Form Library" onClick={onExit} />
      </div>
    );
  }

  return (
    <div className="dfb-builder">
      <div className="dfb-bar">
        <div className="dfb-bar-left">
          
          <div className="dfb-bar-title">
            <span>Smart Form</span>
            
            {/* <small>
              {mode === 'clone' && !formId ? `Copy of ${sourceFormId}` : formId ? `Form ID ${formId}` : ''}
              {state.dirty ? '' : formId ? ', saved' : ''}
            </small> */}
          </div>
        </div>
        <div className="dfb-bar-tabs" role="tablist" aria-label="Builder mode">
          <button type="button" role="tab" aria-selected={view === 'build'} className={view === 'build' ? 'is-on' : ''} onClick={() => setView('build')}>Build</button>
          <button type="button" role="tab" aria-selected={view === 'preview'} className={view === 'preview' ? 'is-on' : ''} onClick={() => setView('preview')}>Preview</button>
          <button type="button" role="tab" aria-selected={view === 'formulas'} className={view === 'formulas' ? 'is-on' : ''} onClick={() => setView('formulas')}>Formulas</button>
        </div>
        <div className="dfb-bar-right">
          <button type="button" className="Button dfb-bar-save" onClick={() => save()} disabled={saving}>
            {saving ? 'Saving…' : formId ? 'Save Changes' : 'Save Form'}
          </button>
          <button type="button" className="dfb-bar-back" onClick={exit}>
            <Icon name="back" /> <span>Form library</span>
          </button>
        </div>
      </div>

      {view === 'preview' ? (
        <div className="dfb-work is-preview"><Preview state={state} /></div>
      ) : view === 'formulas' ? (
        <div className="dfb-work is-preview">
          <FormulaWorkspace liveJson={liveJson} formId={formId} ensureSaved={ensureSaved} onSynced={onFormulasSynced} />
        </div>
      ) : (
        <div className="dfb-work">
          <ElementPanel onAdd={(k) => addElement(k)} dragRef={dragRef} open={panel === 'elements'} onClose={() => setPanel(null)} />
          <Canvas
            title={state.title}
            layout={state.layout}
            items={state.items}
            selectedKey={state.selectedKey}
            dragRef={dragRef}
            dispatch={canvasDispatch}
            onDropNew={(k, index) => addElement(k, index)}
          />
          <PropertiesPanel
            item={selected}
            state={state}
            dispatch={dispatch}
            departments={departments}
            department={department}
            setDepartment={(d) => { setDepartment(d); dispatch({ type: 'TOUCH' }); }}
            formId={formId}
            titleError={titleError}
            onOpenFormulas={() => setView('formulas')}
            formulaUsage={formulaUsage}
            open={panel === 'props'}
            onClose={() => setPanel(null)}
          />
          <div className="dfb-narrow-actions">
            <button type="button" className="ButtonSmall" onClick={() => setPanel('elements')}><Icon name="plus" size={15} /> Add element</button>
            <button type="button" className="ButtonSmall" onClick={() => setPanel('props')}><Icon name="edit" size={15} /> Properties</button>
          </div>
          {panel && <div className="dfb-scrim" onClick={() => setPanel(null)} />}
        </div>
      )}
    </div>
  );
}
