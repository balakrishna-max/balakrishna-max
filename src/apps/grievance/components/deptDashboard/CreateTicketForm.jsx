import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, UploadCloud, X, FileText, Loader2, Sparkles, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { deptDashboardApi } from '../../API/deptDashboardApi';

const PRIORITIES = [
  { value: '1', label: 'High',   cls: 'high'   },
  { value: '2', label: 'Medium', cls: 'medium' },
  { value: '3', label: 'Low',    cls: 'low'    },
];

export default function CreateTicketForm({ config, onCreated }) {
  const [categories, setCategories] = useState([]);
  const [categoryPriorityMap, setCategoryPriorityMap] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [dragover, setDragover] = useState(false);
  const [fileName, setFileName] = useState('');
  const [form, setForm] = useState({
    moduleId: '1',
    email: config.email || '',
    dateTime: '',
    categoryId: '',
    priority: '1',
    description: '',
  });
  const [errors, setErrors] = useState({});

  /* Live clock */
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      setForm((prev) => ({
        ...prev,
        dateTime:
          `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
          `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`,
      }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* Categories */
  useEffect(() => {
    (async () => {
      try {
        const res = await deptDashboardApi.getCategories(config);
        if (res.data?.status === 'SUCCESS') {
          const list = res.data.data || [];
          setCategories(list);
          const map = {};
          list.forEach((c) => { map[c.ticketCategoryId] = c.ticketCategoryPriority; });
          setCategoryPriorityMap(map);
        }
      } catch (err) { console.error(err); }
    })();
  }, [config]);

  const setField = (f, v) => {
    setForm((prev) => ({ ...prev, [f]: v }));
    if (errors[f]) setErrors((prev) => ({ ...prev, [f]: '' }));
  };

  const handleCategoryChange = (id) => {
    setField('categoryId', id);
    const p = categoryPriorityMap[id];
    if (p) setField('priority', String(p));
  };

  const validateFile = (file) => {
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File size must not exceed 5 MB');
      return false;
    }
    const name = file.name.toLowerCase();
    const ok = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.xlsm'].some((e) => name.endsWith(e));
    if (!ok) { toast.error('Supported: PDF, DOC, DOCX, XLS, XLSX'); return false; }
    return true;
  };

  const validate = () => {
    const e = {};
    if (!form.categoryId) e.categoryId = 'Select a category';
    if (!form.priority) e.priority = 'Select priority';
    if (!form.description.trim()) e.description = 'Describe the issue';
    else if (form.description.trim().length < 3) e.description = 'At least 3 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const selectedCategoryName =
      categories.find((c) => String(c.ticketCategoryId) === String(form.categoryId))
        ?.ticketCategoryName || '';
    const fileInput = document.getElementById('dept-file-input');
    const file = fileInput?.files?.[0] || null;
    const issuePage = window.location.pathname.split('/').pop() || '';

    const ticket = {
      ticketModuleId: form.moduleId,
      ticketEmailId: form.email,
      ticketDate: form.dateTime,
      ticketProcessName: selectedCategoryName,
      ticketUrl: issuePage,
      ticketCategory: form.categoryId,
      ticketPriority: form.priority,
      ticketDescription: form.description,
      userType: config.userType,
      ticketStatus: 100,
      ticketClosedDate: '',
      ticketAttachement: '',
      ticketReceivedMode: 1,
      ticketRemarks: '',
      ticketRaisedBy: config.userID,
      supplierUserId: config.userID,
      ticketCreatedBy: config.userID,
      ticketCreatedOn: form.dateTime,
      ticketUpdatedBy: config.userID,
      ticketUpdatedOn: form.dateTime,
      ticketActive: 1,
      ticketSortOrder: 0,
      orgID: config.orgId,
      sName: config.name,
    };

    try {
      const res = await deptDashboardApi.createTicket(config, ticket, file);
      if (res.data?.status === 'SUCCESS') {
        setSuccess(true);
        toast.success(res.data.message || 'Ticket created');
        setTimeout(() => {
          setSuccess(false);
          resetForm();
          onCreated?.();
        }, 1200);
      } else {
        toast.error(res.data?.message || 'Failed to create ticket');
      }
    } catch {
      toast.error('Unable to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm((prev) => ({ ...prev, categoryId: '', priority: '1', description: '' }));
    setErrors({});
    setFileName('');
    const fi = document.getElementById('dept-file-input');
    if (fi) fi.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragover(false);
    const f = e.dataTransfer.files?.[0];
    if (f && validateFile(f)) {
      const fi = document.getElementById('dept-file-input');
      if (fi) fi.files = e.dataTransfer.files;
      setFileName(f.name);
    }
  };

  const descLen = form.description.length;
  const descCls = descLen > 450 ? 'danger' : descLen > 300 ? 'warn' : '';

  return (
    <motion.div
      className="dept-create-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="dept-create-card-header">
        <div className="dept-create-card-icon">
          <Sparkles size={18} />
        </div>
        <div>
          <h2>Create New Ticket</h2>
          <p>Describe your issue and we'll help you resolve</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            className="dept-create-success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <motion.div
              className="dept-create-success-icon"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12 }}
            >
              <Check size={36} />
            </motion.div>
            <h3>Ticket Submitted!</h3>
            <p>Your ticket has been created successfully.</p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={submit}
            className="dept-create-form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="dept-cf-field">
              <label>Module Name <span className="req">*</span></label>
              <select value={form.moduleId} onChange={(e) => setField('moduleId', e.target.value)}>
                <option value="1">A2Z Management System 1</option>
                <option value="2">A2Z Management System 2</option>
              </select>
            </div>

            <div className="dept-cf-row-2">
              <div className="dept-cf-field">
                <label>Email ID</label>
                <input value={form.email} readOnly className="readonly" />
              </div>
              <div className="dept-cf-field">
                <label>Date &amp; Time</label>
                <input value={form.dateTime} readOnly className="readonly" />
              </div>
            </div>

            <div className="dept-cf-row-2">
              <div className="dept-cf-field">
                <label>Issue Category <span className="req">*</span></label>
                <select
                  value={form.categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className={errors.categoryId ? 'has-error' : ''}
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.ticketCategoryId} value={c.ticketCategoryId}>
                      {c.ticketCategoryName}
                    </option>
                  ))}
                </select>
                {errors.categoryId && <span className="dept-cf-error">{errors.categoryId}</span>}
              </div>

              <div className="dept-cf-field">
                <label>Priority <span className="req">*</span></label>
                <div className="dept-priority-group">
                  {PRIORITIES.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={`dept-priority-chip ${o.cls} ${form.priority === o.value ? 'active' : ''}`}
                      onClick={() => setField('priority', o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {errors.priority && <span className="dept-cf-error">{errors.priority}</span>}
              </div>
            </div>

            <div className="dept-cf-field">
              <label>Describe the Issue <span className="req">*</span></label>
              <textarea
                rows={4}
                placeholder="Tell us what's wrong..."
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                className={errors.description ? 'has-error' : ''}
                maxLength={500}
              />
              <div className="dept-cf-field-footer">
                {errors.description ? (
                  <span className="dept-cf-error">{errors.description}</span>
                ) : <span />}
                <span className={`dept-cf-counter ${descCls}`}>{descLen}/500</span>
              </div>
            </div>

            <div className="dept-cf-field">
              <label>Attach File (Optional)</label>
              <div
                className={`dept-cf-upload ${dragover ? 'is-dragging' : ''} ${fileName ? 'has-file' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
                onDragLeave={() => setDragover(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('dept-file-input')?.click()}
              >
                <UploadCloud size={22} />
                <div className="dept-cf-upload-text">
                  {fileName || 'Drag & drop your file here, or click to browse'}
                </div>
                <div className="dept-cf-upload-hint">PDF, DOC, DOCX, XLS, XLSX · max 5MB</div>
                <input
                  id="dept-file-input"
                  type="file"
                  hidden
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.xlsm"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && !validateFile(f)) { e.target.value = ''; return; }
                    setFileName(f?.name || '');
                  }}
                />
              </div>
              <AnimatePresence>
                {fileName && (
                  <motion.div
                    className="dept-cf-file-chip"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                  >
                    <FileText size={14} />
                    <span>{fileName}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFileName('');
                        const fi = document.getElementById('dept-file-input');
                        if (fi) fi.value = '';
                      }}
                    >
                      <X size={12} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="dept-cf-actions">
              <button type="submit" className="dept-cf-btn-primary" disabled={submitting}>
                {submitting ? (
                  <><Loader2 size={14} className="spin" /> Submitting...</>
                ) : (
                  <><Plus size={14} /> Submit Ticket</>
                )}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}