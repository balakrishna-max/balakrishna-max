
export default function InlineBanner({ kind = 'error', title, message, technicalDetail }) {
  if (!message) return null;
  const bg = kind === 'warning' ? '#fef3c7' : '#fee2e2';
  const border = kind === 'warning' ? '#fbbf24' : '#fca5a5';
  const color = kind === 'warning' ? '#92400e' : '#991b1b';

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        color,
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
        marginBottom: 10,
      }}
    >
      {title && <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>}
      <div>{message}</div>
      {technicalDetail && (
        <details style={{ marginTop: 4 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11 }}>Technical details</summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 10, marginTop: 4 }}>{technicalDetail}</pre>
        </details>
      )}
    </div>
  );
}
