const AVATAR_COLORS = [
  { bg: '#DBEAFE', color: '#2563EB' },
  { bg: '#DCFCE7', color: '#15803D' },
  { bg: '#FEE2E2', color: '#DC2626' },
  { bg: '#FEF3C7', color: '#B45309' },
  { bg: '#EDE9FE', color: '#7C3AED' },
  { bg: '#FCE7F3', color: '#DB2777' },
  { bg: '#CFFAFE', color: '#0891B2' },
  { bg: '#D1FAE5', color: '#047857' },
  { bg: '#F3E8FF', color: '#9333EA' },
  { bg: '#FFE4E6', color: '#E11D48' },
];

export function getAvatarColor(key) {
  key = key || '';
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getInitials(user) {
  if (!user) return '??';
  const names = user.trim().split(/\s+/);
  if (names.length >= 2) return (names[0][0] + names[1][0]).toUpperCase();
  return user.substring(0, 2).toUpperCase();
}

export function parseFlexDate(str) {
  if (!str) return null;
  let date = new Date(('' + str).replace(' ', 'T'));
  if (!isNaN(date.getTime())) return date;

  const match = ('' + str).match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (match) {
    let hour = parseInt(match[4], 10);
    const ampm = match[6].toLowerCase();
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    return new Date(parseInt(match[3], 10), parseInt(match[2], 10) - 1, parseInt(match[1], 10), hour, parseInt(match[5], 10));
  }
  return null;
}

export function formatChatTime(dateTime) {
  const d = parseFlexDate(dateTime);
  if (!d) return dateTime || '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day} ${month} ${year} ${time}`;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function formatMonthDay(dateTime) {
  const d = parseFlexDate(dateTime);
  if (!d) return { month: '---', day: '--' };
  return { month: MONTHS[d.getMonth()], day: d.getDate() };
}

const MEETING_END_WINDOW_MINUTES = 30;

export function getMeetingStatus(dateTime) {
  const d = parseFlexDate(dateTime);
  if (!d) return { label: 'Not Started', cls: 'status-notstarted' };
  const now = new Date();
  const endTime = new Date(d.getTime() + MEETING_END_WINDOW_MINUTES * 60 * 1000);
  if (now < d) return { label: 'Not Started', cls: 'status-notstarted' };
  if (now <= endTime) return { label: 'Ongoing', cls: 'status-ongoing' };
  return { label: 'Ended', cls: 'status-ended' };
}


export function buildChatRoomId({ moduleId, sessionId, userId, selectedUserIds, isGroup }) {
  if (isGroup) {
    return `${moduleId}-${sessionId}-group-${selectedUserIds}`;
  }
  const pair = [String(userId), String(selectedUserIds)].sort().join('-');
  return `${moduleId}-${sessionId}-dm-${pair}`;
}


export function normalizeIncomingChatMessage(payload, currentUserId) {
  const senderId = payload.senderId ?? payload.nUserId ?? payload.fromUserId;
  const isOwnMessage = String(senderId) === String(currentUserId);
  return {
    type: isOwnMessage ? 'send' : 'receive',
    sMessageText: payload.message1 ?? payload.sMessageText ?? payload.text ?? '',
    recievedfrom: payload.senderName ?? payload.recievedfrom ?? '',
    dtMessageDatetime: payload.dtMessageDatetime ?? payload.sentAt ?? new Date().toISOString(),
    nChatMasterId: payload.nChatMasterId ?? payload.chatMasterId ?? null,
    fileName: payload.fileName ?? null,
    senderFilePath: payload.senderFilePath ?? null,
  };
}

export function buildFileIconClass(fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  if (['doc', 'docx'].includes(ext)) return 'word';
  if (['xls', 'xlsx'].includes(ext)) return 'excel';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'zip') return 'zip';
  if (ext === 'rar') return 'rar';
  if (['7z', 'tar', 'gz'].includes(ext)) return 'archive';
  return 'generic';
}
