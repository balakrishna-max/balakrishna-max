import { useEffect, useRef, useState, useCallback } from 'react';
import { useCollab } from '../../context/CollabContext.jsx';
import { subscribeTopic, publish } from '../../api/socket.js';
import {
  getChatConversationList,
  getSingleUserChat,
  getMultiUserChat,
  sendSingleChatMessage,
  sendGroupChatMessage,
  markChatRead,
  updateUnreadCountByType,
  downloadCollabFile,
  triggerBlobDownload,
} from '../../api/client.js';
import {
  getAvatarColor,
  getInitials,
  formatChatTime,
  buildFileIconClass,
  buildChatRoomId,
  normalizeIncomingChatMessage,
} from '../../utils/collabHelpers.js';

export default function ChatTab({ onAfterAction }) {
  const { config, selectedUsers, setSelectedUsers, selectedUserIds, asset, socketConnected } = useCollab();
  const isGroup = selectedUserIds.split(',').filter(Boolean).length > 1;

  const [historyOpen, setHistoryOpen] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [chatMasterId, setChatMasterId] = useState('');
  const [conversationOpen, setConversationOpen] = useState(false);

  const messagesEndRef = useRef(null);

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    getChatConversationList(config.sessionId, config.moduleId)
      .then(({ data }) => setHistory(Array.isArray(data) ? data : data?.content || []))
      .catch(() => console.log('Unable to load chat history'))
      .finally(() => setHistoryLoading(false));
  }, [config.sessionId, config.moduleId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);


  const loadThread = useCallback(() => {
    if (!selectedUserIds) return;
    const req = isGroup
      ? getMultiUserChat(config.sessionId, selectedUserIds, config.moduleId)
      : getSingleUserChat(config.sessionId, selectedUserIds, config.moduleId);

    req
      .then(({ data }) => {
        updateUnreadCountByType(config.userId, 'CHAT').catch(() => {});
        const items = Array.isArray(data) ? data : data?.content || [];
        setMessages(items);
        setConversationOpen(true);
        const last = [...items].reverse().find((m) => m.nChatMasterId);
        if (last?.nChatMasterId) {
          setChatMasterId(last.nChatMasterId);
          markChatRead(last.nChatMasterId, config.sessionId).then(() => onAfterAction?.());
        }
      })
      .catch(() => console.log('Unable to load collaboration chat messages'));
  }, [selectedUserIds, isGroup, config.sessionId, config.moduleId, config.userId, onAfterAction]);

  useEffect(() => {
    if (selectedUserIds && !historyOpen) loadThread();
  }, [selectedUserIds, historyOpen, loadThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  useEffect(() => {
    if (historyOpen || !selectedUserIds || !socketConnected) return undefined;

    const roomId = buildChatRoomId({
      moduleId: config.moduleId,
      sessionId: config.sessionId,
      userId: config.userId,
      selectedUserIds,
      isGroup,
    });

    const unsubscribe = subscribeTopic(`/topic/chat/${roomId}`, (payload) => {
      const incoming = normalizeIncomingChatMessage(payload, config.userId);
      setMessages((prev) => [...prev, incoming]);
      if (incoming.nChatMasterId) {
        setChatMasterId(incoming.nChatMasterId);
        markChatRead(incoming.nChatMasterId, config.sessionId).then(() => onAfterAction?.());
      }
      if (incoming.type === 'receive') {
        updateUnreadCountByType(config.userId, 'CHAT').catch(() => {});
      }
      loadHistory();
    });

    return unsubscribe;
  }, [historyOpen, selectedUserIds, isGroup, socketConnected, config, loadHistory, onAfterAction]);

  const sendMessage = () => {
    const trimmed = text.trim();
    if (!trimmed || !selectedUserIds) return;
    setText('');

    const base = {
      tenderId: config.sessionId,
      message1: trimmed,
      moduleId: config.moduleId,
      senderId: config.userId,
    };
    const payload = isGroup
      ? { ...base, multiUserIds: selectedUserIds }
      : { ...base, singleuserId: selectedUserIds, nChatMasterId: chatMasterId };


    const delivered = publish('/app/chat.send', payload);

    if (!delivered) {
      const req = isGroup ? sendGroupChatMessage(payload) : sendSingleChatMessage(payload);
      req
        .then(({ data }) => {
          if (!isGroup && data) setMessages(Array.isArray(data) ? data : data?.content || []);
          else loadThread();
          loadHistory();
        })
        .catch((err) =>
          alert(err.isServerErrorPage ? 'Server error while sending message. Please try again.' : 'Failed to send message.')
        );
    }
  };

  const onAttachClick = () => {
    alert(
      'File attachments inside chat aren\'t available yet — there is no backend endpoint for it. ' +
        'Use the Share tab to send documents instead.'
    );
  };

  const startNewChat = () => {
    setSelectedUsers([]);
    setChatMasterId('');
    setConversationOpen(false);
    setHistoryOpen(false);
  };

  const openConversation = (item) => {
    const ids = ('' + (item.userIds || '')).split(',').map((s) => s.trim()).filter(Boolean);
    const users = ids.map((id) => ({ id, label: item.memberNames || item.displayName || 'User' }));
    setSelectedUsers(users);
    setHistoryOpen(false);
  };

  return (
    <div id="a2z-collab-chat" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className={`chat-history-overlay${historyOpen ? ' open' : ''}`}>
        <div className="chat-history-top-bar">
          <button type="button"
            className="chat-history-back-btn"
            onClick={() => conversationOpen && selectedUserIds && setHistoryOpen(false)}
          >
            ‹ Back
          </button>
          <div className="chat-history-top-actions">
            <button type="button" className="chat-history-new-btn" onClick={startNewChat}>
              + New Chat
            </button>
            <button type="button" className="chat-history-view-btn" onClick={loadHistory}>
              Refresh
            </button>
          </div>
        </div>
        <div className="chat-history-section-label">
          RECENT
          <span className={`chat-socket-dot${socketConnected ? ' online' : ''}`} title={socketConnected ? 'Live' : 'Connecting…'} />
        </div>
        <div className="chat-history-list">
          {historyLoading && <div className="chat-history-loading">Loading conversations...</div>}
          {!historyLoading && history.length === 0 && (
            <div className="chat-history-empty">No conversations yet. Tap "New Chat" to start one.</div>
          )}
          {history.map((item, i) => {
            const displayName = item.displayName || item.memberNames || 'Conversation';
            const c = getAvatarColor(displayName);
            return (
              <div className="chat-history-item" key={i} onClick={() => openConversation(item)}>
                <div className="chat-history-item-icon" style={{ background: c.bg, color: c.color }}>
                  {getInitials(displayName)}
                </div>
                <div className="chat-history-item-info">
                  <div className="chat-history-item-name">{displayName}</div>
                  <div className="chat-history-item-meta">{item.lastMessage || 'No messages yet'}</div>
                </div>
                <div className="chat-history-item-time">
                  {formatChatTime(item.lastMessageTime)}
                  {item.unreadCount > 0 && <span className="chat-history-item-badge">{item.unreadCount}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!historyOpen && (
        <>
          <div className="chat-view-history-wrap">
            <button type="button" className="chat-view-history-btn" onClick={() => setHistoryOpen(true)}>
              History
            </button>
          </div>

          <div className="a2z-collab-chat-messages">
            {!selectedUserIds && <div className="a2z-collab-chat-empty-state">Select a collaborator to start chatting.</div>}
            {selectedUserIds && messages.length === 0 && <div className="a2z-collab-chat-empty-state">No messages yet. Say hello!</div>}
            {messages.map((item, i) => {
              const isReceive = item.type === 'receive';
              const side = isReceive ? 'left' : 'right';
              const hasFile = !!(item.fileName && item.senderFilePath);
              const iconClass = hasFile ? buildFileIconClass(item.fileName) : null;

              return (
                <div className={`a2z-collab-chat-row ${side}`} key={i}>
                  {isReceive && <img src={asset('/resources/img/profile-pic-one.svg')} className="a2z-collab-chat-avatar" alt="" />}
                  <div>
                    <div className={`a2z-collab-chat-name${side === 'right' ? ' right' : ''}`}>
                      {side === 'right' ? 'You' : item.recievedfrom || ''}{' '}
                      <span className="a2z-collab-chat-time">{formatChatTime(item.dtMessageDatetime)}</span>
                    </div>
                    {hasFile ? (
                      <div className={`a2z-collab-chat-bubble ${side} a2z-collab-file-bubble`}>
                        <div className={`file-bubble-icon ${iconClass}`}>{iconClass?.toUpperCase().slice(0, 3)}</div>
                        <div className="file-bubble-meta">
                          <div className="file-bubble-name">{item.fileName}</div>
                        </div>
                        <button
                          type="button"
                          className="file-bubble-download"
                          onClick={() => {
                            const messageId = item.nMessageId || item.nChatMasterId || item.nUserId;
                            if (!messageId) return alert('Unable to download — no message ID found on this item.');
                            downloadCollabFile(messageId)
                              .then((res) => triggerBlobDownload(res.data, item.fileName, res.headers['content-disposition']))
                              .catch(() => alert('Unable to download file. Please try again.'));
                          }}
                        >
                          <img src={asset('/resources/img/download-icon-new.svg')} alt="Download" />
                        </button>
                      </div>
                    ) : (
                      <div className={`a2z-collab-chat-bubble ${side}`}>{item.sMessageText}</div>
                    )}
                    {side === 'right' && <div className="a2z-collab-chat-delivered">Delivered</div>}
                  </div>
                  {side === 'right' && <img src={asset('/resources/img/profile-pic-one.svg')} className="a2z-collab-chat-avatar" alt="" />}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="a2z-collab-message-input-one">
            <button type="button" className="a2z-collab-attach-btn" onClick={onAttachClick}>
              <img src={asset('/resources/img/attach_icon.svg')} alt="Attach" />
            </button>
            <input
              type="text"
              placeholder="Type your message here"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  sendMessage();
                }
              }}
            />
            <button type="button" className="a2z-collab-chat-send-btn" onClick={sendMessage}>
              <img src={asset('/resources/chatboat-source/send_icon.svg')} alt="Send" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
