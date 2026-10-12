
import Swal from 'sweetalert2/dist/sweetalert2.esm.js';
import 'sweetalert2/dist/sweetalert2.css';

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const titleCase = (msg) => String(msg).replace(/\b\w/g, (ch) => ch.toUpperCase());

export function notSaved(msg) {
  return Swal.fire({
    html: `<h3 class="text-danger">${escapeHtml(titleCase(msg))}</h3>`,
    showCloseButton: false,
    allowEscapeKey: false,
    allowOutsideClick: false,
    showConfirmButton: true,
  });
}

export function errorDialog(title, html) {
  return Swal.fire({ icon: 'error', title, html, confirmButtonColor: '#e74c3c' });
}


export function savedDialog(message, formId) {
  const html = formId
    ? `<h4>${escapeHtml(message)}</h4><h5><b>Form ID:</b> ${escapeHtml(formId)}</h5>`
    : escapeHtml(message);
  return Swal.fire({ icon: 'success', html, confirmButtonText: 'OK', confirmButtonColor: '#3085d6', allowOutsideClick: false });
}


export async function confirmDialog(msg) {
  const r = await Swal.fire({
    title: `<h3 class='text-info'>${escapeHtml(msg)}</h3>`,
    showCancelButton: true,
    confirmButtonColor: '#051a53',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Yes',
    cancelButtonText: 'No',
    allowEscapeKey: false,
    allowOutsideClick: false,
  });
  return !!(r && r.isConfirmed);
}
