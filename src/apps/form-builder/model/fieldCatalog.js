import { defaultSource } from './dynamicSource';
import {
  EMAIL_PATTERN, PHONE_PATTERN, TIME_PATTERN,
  uid, newFieldId, uniqueLabel, nextTableId, uniqueTableHeader, newChoiceValue,
} from './schema';


const comp = (c) => ({ key: uid(), kind: 'component', comp: c });

const text = (items, base, extra = {}) =>
  comp({
    id: newFieldId(), label: uniqueLabel(base, items), type: 'text', required: 'no',
    inputType: 'text', minlength: null, maxlength: null, pattern: null, ...extra,
  });

const textarea = (items, base, extra = {}) =>
  comp({
    id: newFieldId(), label: uniqueLabel(base, items), type: 'textarea', required: 'no',
    minlength: null, maxlength: null, rows: null, cols: null, pattern: null, ...extra,
  });

const choice = (items, type, base, labels) =>
  comp({
    id: newFieldId(), label: uniqueLabel(base, items), type, required: 'no',
    options: labels.map((l, i) => ({ value: newChoiceValue(type, i), label: l })),
  });

const rich = (label, content) => comp({ id: newFieldId('richtext'), type: 'richtext', label, content });

const section = (items) => {
  const tableId = nextTableId(items);
  const n = tableId.split('_')[1];
  return {
    key: uid(),
    kind: 'section',
    sec: {
      tableId,
      tableHeader: uniqueTableHeader(`Section ${n}`, items),
      tableColumns: [
        { id: 'column_header_1', columnHeader: 'Column Header 1', inputType: 'text', required: 'no' },
        { id: 'column_header_2', columnHeader: 'Column Header 2', inputType: 'date', required: 'no' },
        { id: 'column_header_3', columnHeader: 'Column Header 3', inputType: 'textarea', required: 'no' },
        { id: 'column_header_4', columnHeader: 'Column Header 4', inputType: 'text', required: 'no' },
      ],
    },
  };
};

export const ELEMENTS = {
  heading: { label: 'Heading', icon: 'heading', create: () => [rich('Heading', '<h2>Heading</h2><p>Add a short description</p>')] },
  fullName: {
    label: 'Full Name', icon: 'user',
    create: (items) => {
      const first = text(items, 'First Name', { maxlength: '50' });
      const last = text([...items, first], 'Last Name', { maxlength: '50' });
      return [first, last];
    },
  },
  email: { label: 'Email', icon: 'mail', create: (items) => [text(items, 'Email', { inputType: 'email', pattern: EMAIL_PATTERN, placeholder: 'example@example.com' })] },
  address: { label: 'Address', icon: 'pin', create: (items) => [textarea(items, 'Address', { rows: '3', maxlength: '250' })] },
  phone: { label: 'Phone', icon: 'phone', create: (items) => [text(items, 'Phone Number', { inputType: 'tel', pattern: PHONE_PATTERN, maxlength: '10', placeholder: '10-digit mobile number' })] },
  datePicker: {
    label: 'Date Picker', icon: 'calendar',
    create: (items) => [comp({ id: newFieldId(), label: uniqueLabel('Date', items), type: 'date', required: 'no', dateFormat: 'YYYY-MM-DD', minDate: null, maxDate: null })],
  },

  shortText: { label: 'Short Text', icon: 'short', create: (items) => [text(items, 'Short Text')] },
  longText: { label: 'Long Text', icon: 'long', create: (items) => [textarea(items, 'Long Text')] },
  paragraph: { label: 'Paragraph', icon: 'para', create: () => [rich('Paragraph', '<p>Type your paragraph here.</p>')] },
  dropdown: {
    label: 'Dropdown', icon: 'dropdown',
    create: (items) => [comp({
      id: newFieldId(), label: uniqueLabel('Dropdown', items), type: 'select', required: 'no',
      options: [
        { value: '', label: '-Select-', selected: true, isPlaceholder: true },
        { value: 'Option 1', label: 'Option 1', selected: false },
        { value: 'Option 2', label: 'Option 2', selected: false },
      ],
    })],
  },
  singleChoice: { label: 'Single Choice', icon: 'radio', create: (items) => [choice(items, 'radio', 'Single Choice', ['Option 1', 'Option 2', 'Option 3'])] },
  multipleChoice: { label: 'Multiple Choice', icon: 'check', create: (items) => [choice(items, 'checkbox', 'Multiple Choice', ['Option 1', 'Option 2', 'Option 3'])] },
  number: {
    label: 'Number', icon: 'number',
    create: (items) => [comp({ id: newFieldId(), label: uniqueLabel('Number', items), type: 'number', required: 'no', min: null, max: null, step: null, pattern: null, userGroupType: '103' })],
  },
  image: { label: 'Image', icon: 'image', create: () => [rich('Image', '<p><em>Select this block and add an image URL.</em></p>')] },
  fileUpload: {
    label: 'File Upload', icon: 'upload',
    create: (items) => [comp({ id: newFieldId(), label: uniqueLabel('File Upload', items), type: 'file', required: 'no', fileTypes: null, min: null, max: null, multiple: 'no' })],
  },
  time: { label: 'Time', icon: 'clock', create: (items) => [text(items, 'Time', { inputType: 'time', pattern: TIME_PATTERN, maxlength: '5', placeholder: 'HH:MM' })] },
  spinner: {
    label: 'Spinner', icon: 'spinner',
    create: (items) => [comp({ id: newFieldId(), label: uniqueLabel('Quantity', items), type: 'number', required: 'no', min: '0', max: null, step: '1', pattern: null, userGroupType: '103' })],
  },

  inputTable: { label: 'Input Table', icon: 'table', create: (items) => [section(items)] },
  starRating: { label: 'Star Rating', icon: 'star', create: (items) => [choice(items, 'radio', 'Star Rating', ['1 star', '2 stars', '3 stars', '4 stars', '5 stars'])] },
  scaleRating: { label: 'Scale Rating', icon: 'bars', create: (items) => [choice(items, 'radio', 'Scale Rating', ['1', '2', '3', '4', '5'])] },

  divider: { label: 'Divider', icon: 'divider', create: () => [rich('Divider', '<hr>')] },

  dynamicDropdown: {
    label: 'Dynamic Dropdown', icon: 'api',
    create: (items) => [comp({
      id: newFieldId(), label: uniqueLabel('Dynamic Dropdown', items), type: 'select', required: 'no',
      options: [{ value: '', label: '-Select-', selected: true, isPlaceholder: true }],
      dataSource: defaultSource(),
    })],
  },
  signature: {
    label: 'Signature', icon: 'sign',
    create: (items) => [comp({ id: newFieldId(), label: uniqueLabel('Signature', items), type: 'signature', required: 'no', penColor: '#000000', height: '160' })],
  },
};

export const PALETTE = [
  { title: 'Common', keys: ['heading', 'fullName', 'email', 'address', 'phone', 'datePicker'] },
  { title: 'Basic elements', keys: ['shortText', 'longText', 'paragraph', 'dropdown',  'singleChoice', 'multipleChoice', 'number', 'image', 'fileUpload', 'spinner'] },
  { title: 'Survey elements', keys: ['inputTable', 'starRating', 'scaleRating'] },
  { title: 'Page elements', keys: ['divider'] },
];

// { title: 'Basic elements', keys: ['shortText', 'longText', 'paragraph', 'dropdown', 'dynamicDropdown', 'singleChoice', 'multipleChoice', 'number', 'image', 'fileUpload', 'signature', 'time', 'spinner'] },


export function describeItem(item) {
  if (item.kind === 'section') return 'Input table';
  const c = item.comp;
  if (c.type === 'richtext') return 'Text block';
  if (c.type === 'text') {
    return { email: 'Email', tel: 'Phone', time: 'Time' }[c.inputType] || 'Short text';
  }
  if (c.type === 'select' && c.dataSource) return 'Dynamic dropdown';
  return {
    signature: 'Signature',
    textarea: 'Long text', number: 'Number', select: 'Dropdown', radio: 'Single choice',
    checkbox: 'Multiple choice', date: 'Date', dates: 'Date', file: 'File upload',
  }[c.type] || c.type;
}
