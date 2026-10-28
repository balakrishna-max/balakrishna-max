import React, { useEffect, useState } from 'react';
import {
  Calendar, Mail, FileText, AlertTriangle,
  UploadCloud, X, Send, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { deptGrievanceApi } from '../../API/deptGrievanceApi';

const PRIORITIES = [
  { value: '1', label: 'High' },
  { value: '2', label: 'Medium' },
  { value: '3', label: 'Low' },
];

export default function RaiseTicketPage({ config, onTicketCreated }) {
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [hiddenCategory, setHiddenCategory] = useState(null);
  const [form, setForm] = useState({
    ticketCategory: '',
    priority: '',
    schemaDesc: '',
    file: null,
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [dragover, setDragover] = useState(false);
  const [now, setNow] = useState(new Date());

  /* Live clock */
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* Fetch categories + auto-match current page (same as JSP logic) */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await deptGrievanceApi.getCategoryList(config);
        if (cancelled) return;
        if (res.data?.status === 'SUCCESS' && Array.isArray(res.data.data)) {
          setCategories(res.data.data);

          const enteredPageUrl = config.currentFileName;
          const match = res.data.data.find(
            (c) => c.ticketCategoryUrl === enteredPageUrl
          );
          if (match) {
            setHiddenCategory(match);
            setForm((f) => ({ ...f, priority: '1' }));
          }
        }
      } catch (err) {
        console.error('Category fetch failed:', err);
        toast.error('Could not load categories');
      } finally {
        if (!cancelled) setLoadingCats(false);
      }
    })();
    return () => { cancelled = true; };
  }, [config]);

  const fmt = (d) => {
    const p = (n) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
      `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    );
  };

  const updateField = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragover(false);
    const f = e.dataTransfer.files?.[0];
    if (f) updateField('file', f);
  };

  const validate = () => {
    const e = {};
    if (!hiddenCategory && !form.ticketCategory)
      e.ticketCategory = 'Please select an issue category';
    if (!form.priority) e.priority = 'Please select a priority';
    if (!form.schemaDesc.trim())
      e.schemaDesc = 'Please describe your issue';
    else if (form.schemaDesc.trim().length < 3)
      e.schemaDesc = 'Description must be at least 3 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) {
      toast.error('Please fix the errors and try again');
      return;
    }
    setSubmitting(true);

    const nowStr = fmt(now);

    const categoryName = hiddenCategory
      ? hiddenCategory.ticketCategoryName
      : categories.find(
          (c) => String(c.ticketCategoryId) === String(form.ticketCategory)
        )?.ticketCategoryName || 'Other';

    const ticketCategoryId = hiddenCategory
      ? parseInt(hiddenCategory.ticketCategoryId)
      : parseInt(form.ticketCategory, 10);

    const mobileNumber = config.mobile || config.phone || '';

    const ticket = {
      ticketModuleId: 102,
      ticketEmailId: config.email,
      ticketMobileNumber: mobileNumber,
      ticketDate: nowStr,
      ticketProcessName: categoryName,
      ticketUrl: config.currentFileName,
      ticketCategory: ticketCategoryId,
      ticketPriority: form.priority,
      userType: config.userType,
      ticketDescription: form.schemaDesc,
      ticketStatus: 0,
      ticketClosedDate: '',
      ticketAttachement: '',
      ticketReceivedMode: 1,
      ticketRemarks: '',
      ticketRaisedBy: config.userID,
      supplierUserId: config.userID,
      ticketCreatedBy: config.userID,
      ticketCreatedOn: nowStr,
      ticketUpdatedBy: config.userID,
      ticketUpdatedOn: nowStr,
      ticketActive: 1,
      ticketSortOrder: 0,
      orgID: config.orgId,
      sName: config.name,
    };

    try {
      const res = await deptGrievanceApi.createTicket(config, ticket, form.file);

      if (res.data?.status === 'SUCCESS') {
        toast.success('Ticket created successfully!');
        onTicketCreated({
          ...res.data.data,
          categoryFaqsDTO: res.data.data.categoryFaqsDTO || [],
          categorySteps: res.data.data.categorySteps || [],
        });
      } else {
        toast.error(res.data?.data?.ticketStatus || 'Ticket creation failed');
      }
    } catch (err) {
      console.error('Create ticket error:', err);
      toast.error('Unable to create ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grv-card">
      {/* ======================== META STRIP ======================== */}
      <div className="grv-meta-grid">
        <div className="grv-meta-item">
          <div className="grv-meta-icon"><Calendar size={18} /></div>
          <div>
            <div className="grv-meta-label">Date & Time</div>
            <div className="grv-meta-value">{fmt(now)}</div>
          </div>
        </div>

        <div className="grv-meta-item">
          <div className="grv-meta-icon"><Mail size={18} /></div>
          <div>
            <div className="grv-meta-label">Email</div>
            <div className="grv-meta-value">{config.email}</div>
          </div>
        </div>

        <div className="grv-meta-item">
          <div className="grv-meta-icon"><FileText size={18} /></div>
          <div>
            <div className="grv-meta-label">Issue Page</div>
            <div className="grv-meta-value">{config.currentFileName}</div>
          </div>
        </div>
      </div>

      {/* ======================== FORM ======================== */}
      <form onSubmit={submit}>
        <div className="grv-form-grid">
          {/* Category */}
          <div className="grv-form-group">
            <label className="grv-label">
              Issue Category <span className="grv-label-req">*</span>
            </label>

            {hiddenCategory ? (
              <input
                className="grv-input"
                value={hiddenCategory.ticketCategoryName}
                readOnly
              />
            ) : loadingCats ? (
              <div className="grv-skeleton" style={{ height: 44 }} />
            ) : (
              <select
                className={`grv-select ${errors.ticketCategory ? 'error' : ''}`}
                value={form.ticketCategory}
                onChange={(e) => updateField('ticketCategory', e.target.value)}
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.ticketCategoryId} value={c.ticketCategoryId}>
                    {c.ticketCategoryName}
                  </option>
                ))}
                <option value="500">Other</option>
              </select>
            )}

            {errors.ticketCategory && (
              <div className="grv-error-msg">
                <AlertTriangle size={12} /> {errors.ticketCategory}
              </div>
            )}
          </div>

          {/* Priority */}
          <div className="grv-form-group">
            <label className="grv-label">
              Priority <span className="grv-label-req">*</span>
            </label>
            <select
              className={`grv-select ${errors.priority ? 'error' : ''}`}
              value={form.priority}
              onChange={(e) => updateField('priority', e.target.value)}
            >
              <option value="">Select Priority</option>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {errors.priority && (
              <div className="grv-error-msg">
                <AlertTriangle size={12} /> {errors.priority}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="grv-form-group">
          <label className="grv-label">
            Describe the Issue <span className="grv-label-req">*</span>
          </label>
          <textarea
            className={`grv-textarea ${errors.schemaDesc ? 'error' : ''}`}
            placeholder="Provide detailed information about your issue…"
            rows={5}
            value={form.schemaDesc}
            onChange={(e) => updateField('schemaDesc', e.target.value)}
          />
          <div className="grv-counter-row">
            {errors.schemaDesc ? (
              <div className="grv-error-msg">
                <AlertTriangle size={12} /> {errors.schemaDesc}
              </div>
            ) : <span />}
            <span className="grv-counter">
              {form.schemaDesc.length}/500
            </span>
          </div>
        </div>

        {/* File Upload */}
        <div className="grv-form-group">
          <label className="grv-label">Attachment (Optional)</label>

          {!form.file ? (
            <div
              className={`grv-upload ${dragover ? 'dragover' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
              onDragLeave={() => setDragover(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('grv-dept-file').click()}
            >
              <div className="grv-upload-icon"><UploadCloud size={28} /></div>
              <div className="grv-upload-text">
                Drag &amp; drop your file here, or click to browse
              </div>
              <div className="grv-upload-hint">
                PDF, PNG, JPG up to 5MB
              </div>
              <input
                id="grv-dept-file"
                type="file"
                hidden
                onChange={(e) => updateField('file', e.target.files?.[0] || null)}
              />
            </div>
          ) : (
            <div className="grv-file-chip">
              <FileText size={16} />
              <span style={{ flex: 1 }}>{form.file.name}</span>
              <span style={{ fontSize: 11, color: '#6b7280' }}>
                {(form.file.size / 1024).toFixed(1)} KB
              </span>
              <X
                size={16}
                style={{ cursor: 'pointer' }}
                onClick={() => updateField('file', null)}
              />
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="grv-actions">
          <button
            type="submit"
            className="grv-btn grv-btn-primary grv-btn-block"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="spin" /> Submitting…
              </>
            ) : (
              <>
                <Send size={16} /> Submit Ticket
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}