import React, { useEffect, useState } from 'react';
import {
  Calendar, Mail, FileText, AlertTriangle,
  UploadCloud, X, Send, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { grievanceApi } from '../../API/grievanceApi';

const TicketForm = ({ config, onSuccess }) => {
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dragover, setDragover] = useState(false);
  const [form, setForm] = useState({
    ticketCategory: '',
    priority: '',
    schemaDesc: '',
    file: null,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await grievanceApi.getCategories();
        if (cancelled) return;
        if (res.data.status === 'SUCCESS' && Array.isArray(res.data.data)) {
          setCategories(res.data.data);
        }
      } catch (err) {
        console.error('Categories fetch failed:', err);
        toast.error('Could not load categories');
      } finally {
        if (!cancelled) setLoadingCats(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const updateField = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer.files?.[0];
    if (file) updateField('file', file);
  };

  const validate = () => {
    const e = {};
    if (!form.ticketCategory) e.ticketCategory = 'Please select an issue category';
    if (!form.priority) e.priority = 'Please select a priority';
    if (!form.schemaDesc.trim()) e.schemaDesc = 'Please describe your issue';
    else if (form.schemaDesc.trim().length < 10)
      e.schemaDesc = 'Description must be at least 10 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the errors and try again');
      return;
    }
    setSubmitting(true);

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const catName =
      categories.find((c) => String(c.ticketCategoryId) === String(form.ticketCategory))
        ?.ticketCategoryName || 'Other';

    const payload = {
      ticketModuleId: 102,
      ticketEmailId: config.email,
      ticketMobileNumber: config.mobileNumber || '',
      ticketDate: now,
      ticketProcessName: catName,
      ticketUrl: config.currentFileName,
      ticketCategory: parseInt(form.ticketCategory, 10),
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
      ticketCreatedOn: now,
      ticketUpdatedBy: config.userID,
      ticketUpdatedOn: now,
      ticketActive: 1,
      ticketSortOrder: 0,
      orgID: config.orgId,
      sName: config.name,
    };

    try {
      const res = await grievanceApi.createTicket(payload, form.file);
      if (res.data.status === 'SUCCESS') {
        toast.success('Ticket created successfully!');
        onSuccess(res.data.data);
      } else {
        toast.error(res.data.data?.ticketStatus || 'Ticket creation failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Unable to create ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const priorities = [
    { value: '1', label: '🔴 High', cls: 'high' },
    { value: '2', label: '🟡 Medium', cls: 'medium' },
    { value: '3', label: '🟢 Low', cls: 'low' },
  ];

  return (
    <div className="grv-card">
      {/* Meta grid */}
      <div className="grv-meta-grid">
        <div className="grv-meta-item">
          <div className="grv-meta-icon"><Calendar size={18} /></div>
          <div>
            <div className="grv-meta-label">Date & Time</div>
            <div className="grv-meta-value">{new Date().toLocaleString()}</div>
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

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Category */}
          <div className="grv-form-group">
            <label className="grv-label">
              Issue Category <span className="grv-label-req">*</span>
            </label>
            {loadingCats ? (
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
              {priorities.map((p) => (
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
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {errors.schemaDesc ? (
              <div className="grv-error-msg">
                <AlertTriangle size={12} /> {errors.schemaDesc}
              </div>
            ) : <span />}
            <span style={{ fontSize: 11, color: '#9ca3af' }}>
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
              onClick={() => document.getElementById('grv-file').click()}
            >
              <div className="grv-upload-icon"><UploadCloud size={28} /></div>
              <div className="grv-upload-text">
                Drag & drop your file here, or click to browse
              </div>
              <div className="grv-upload-hint">
                PDF, PNG, JPG up to 5MB
              </div>
              <input
                id="grv-file"
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

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          form > div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default TicketForm;