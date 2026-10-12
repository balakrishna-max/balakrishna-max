
let urls = {};
export function configureNavigation(config) {
  urls = {
    previewFormula: 'textDynamicForm.html',
    dashboard: 'admindashboard.html',
    library: 'dynamicFormCreation.html',
    ...((config && config.navigation) || {}),
  };
}

function post(action, fields = {}) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  form.name = 'dynamicFormList';
  form.style.display = 'none';
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value == null ? '' : String(value);
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

export const openPreviewFormula = (formId) => post(urls.previewFormula, { hdnFormIdValue: formId });
export const goToDashboard = () => post(urls.dashboard, { hdnFormIdValue: '' });
export const reloadLibrary = () => post(urls.library, { hdnFormIdValue: '' });
