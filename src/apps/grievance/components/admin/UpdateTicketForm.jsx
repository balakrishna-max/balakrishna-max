import React, { useEffect, useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { grievanceApi } from '../../API/grievanceApi';

const UpdateTicketForm = ({ config, ticket, users, onUpdated }) => {
  const [statuses, setStatuses] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [loadingMasters, setLoadingMasters] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    status: ticket.ticketStatus || '',
    priority: ticket.ticketPriority || '',
    assignedTo: ticket.ticketAssignedTo || '',
    comments: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const [stsRes, prRes] = await Promise.all([
          grievanceApi.fetchMaster('STS'),
          grievanceApi.fetchMaster('PR'),
        ]);
        if (stsRes.data?.data) setStatuses(stsRes.data.data);
        if (prRes.data?.data) setPriorities(prRes.data.data);
      } catch {
        toast.error('Failed to load master data');
      } finally {
        setLoadingMasters(false);
      }
    })();
  }, []);

  // Sync when ticket changes
  useEffect(() => {
    setForm({
      status: ticket.ticketStatus || '',
      priority: ticket.ticketPriority || '',
      assignedTo: ticket.ticketAssignedTo || '',
      comments: '',
    });
  }, [ticket.ticketId]);

  const canSubmit = ticket.ticketStatus !== 104 && ticket.ticketStatus !== 105;

  const handleSubmit = async () => {
    if (!form.status)  return toast.error('Please select Status');
    if (!form.priority) return toast.error('Please select Priority');
    if (!form.assignedTo) return toast.error('Please select Assigned Agent');
    if (!form.comments.trim()) return toast.error('Please enter Comments');

    setSubmitting(true);
    const payload = {
      ticketCategory: ticket.ticketCategory,
      ticketPriority: form.priority,
      ticketAssignedTo: form.assignedTo,
      ticketComments: form.comments,
      ticketStatus: form.status,
      ticketupdatedOn: new Date().toISOString().slice(0, 19).replace('T', ' '),
      ticketUpdatedBy: config.userID,
      orgId: config.orgId,
    };

    try {
      const res = await grievanceApi.updateTicket(ticket.ticketId, payload);
      if (res.data.status === 'SUCCESS') {
        toast.success(`${ticket.ticketNumber} updated successfully`);
        setForm((p) => ({ ...p, comments: '' }));
        onUpdated?.();
      } else {
        toast.error(res.data.data?.ticketStatus || 'Update failed');
      }
    } catch {
      toast.error('Failed to update ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="update-form">
      <div className="update-header">
        <h3>Update Ticket</h3>
      </div>

      <div className="update-grid">
        <Field label="Status">
          <select
            value={form.status}
            disabled={loadingMasters}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="">-- Select Status --</option>
            {statuses.map((s) => (
              <option key={s.masterDataValue} value={s.masterDataValue}>
                {s.masterDataDisplayName}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Priority">
          <select
            value={form.priority}
            disabled={loadingMasters}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            <option value="">-- Select Priority --</option>
            {priorities.map((p) => (
              <option key={p.masterDataValue} value={p.masterDataValue}>
                {p.masterDataDisplayName}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Assigned Agent">
          <select
            value={form.assignedTo}
            onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
          >
            <option value="">-- Select Agent --</option>
            {users.map((u) => (
              <option key={u.helpDeskUserId} value={u.helpDeskUserId}>
                {u.helpDeskUserFirstName}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Comments" full>
        <textarea
          rows={3}
          placeholder="Enter your comments…"
          value={form.comments}
          onChange={(e) => setForm({ ...form, comments: e.target.value })}
        />
      </Field>

      <div className="update-actions">
        <button
          className="btn-primary"
          disabled={submitting || !canSubmit}
          onClick={handleSubmit}
        >
          {submitting ? <><Loader2 size={14} className="spin" /> Updating…</> : <><Save size={14} /> Update Ticket</>}
        </button>
      </div>
    </div>
  );
};

const Field = ({ label, children, full }) => (
  <div className={`field ${full ? 'full' : ''}`}>
    <label>{label}</label>
    {children}
  </div>
);

export default UpdateTicketForm;