# Collaboration panel

Part of **a2z-react-apps** (see the main README for how it is built and loaded).
Code: `src/apps/collab/`. Opened by the collaboration icon (`#collaborationSlideId a`) on every page.

**Changed in the merge:** the panel no longer runs in an iframe from another server. It renders on the page
itself (like the original JSP offcanvas), so every request is same-origin with the MVC app: the session cookie
is sent automatically and no CORS setup is needed. `src/apps/collab/index.jsx` is the in-page entry
(it replaces `main.jsx` / `embed.jsx`). The iframe/standalone instructions of the old project no longer apply.


A standalone React app that reproduces the original offcanvas collaboration
panel (chat, share docs, meetings, email) — same CSS classes, same
endpoints, same request/response contracts as the JSP. It talks straight
to your existing Spring MVC controllers; nothing on the server changes.

## What's faithfully ported

- **CSS**: `src/apps/collab/styles/collab.css` is a near-verbatim copy of both
  stylesheets from the original JSP (`collabration-overlay.css` + the
  inline `<style>` block), same class names throughout.
- **Every endpoint** the JSP called, with the exact same param names —
  including the (intentionally) "swapped" naming where `filterType=sent`
  for Share Docs hits `getreceivedocdetails.html` and `received` hits
  `getsharedocdetails.html`. See `src/apps/collab/api/client.js`.
- **Chat**: recent-conversations history overlay, single + group threads,
  file attachments, 3s polling, read receipts — via
  `getChatConversationList.html`, `get(single|multi)chatdetails.html`,
  `save(Single|multiuser)details.html`, `save(Single|Multi)ChatFileDetails.html`,
  `updateChatDetails.html`, `get(Group)?ChatUpdate.html`.
- **Share**: dropzone upload, description, received/sent filter, pagination,
  avatar footer — via `shareDocAjax.html`, `get(share|receivedoc)details.html`,
  `downloadCollabFile`.
- **Meeting**: create invitation, received/sent filter, live status
  (Not Started / Ongoing / Ended, 30-min window), join/details buttons —
  via `saveMeetingInvitationDetails.html`, `get(Shared)?MeetingInvitationDetails.html`,
  `updateInvitationDetails.html`.
- **Email**: compose, received/sent filter (matches by `mailType`), detail
  view — via `sendSmsOrEmail.html`, `get(Shared)?EMailDetails.html`,
  `updateEmailDetails.html`.
- **Recipients**: chip/token field with search suggestions, backed by
  `subUsersDetails` (supplier/sub-user types) or
  `getuserdetailsByDepartId.html` (department type '103') — same avatar
  color-hash + initials logic as the JSP's `getAvatarColor`/`getInitials`.
- **Unread badges**: per-tab counts via `getRecvdCount.html`, cleared via
  `updateUnreadCountByType` on tab/view open — matches `fnUpdateUnreadCountByType`.

## Consciously simplified / not ported

These add real complexity for comparatively low functional value, and
were left out of this pass — happy to add any of them next:
- **AI Chat Assistant** panel (the `#a2z-collab-ai-chat` wrapper / gradient
  welcome screen / separate chat endpoint).
- **flatpickr** date/time picker for meetings — uses a native
  `<input type="datetime-local">` instead (same data going to the server).
- **Choices.js**-specific interaction details (keyboard nav, fuzzy search
  scoring) — the chip field here does plain substring search.
- **Avatar tooltips** (`data-tip` hover bubbles) and the "+N more" avatar
  overflow stack — footer currently lists every name directly.
- **Drag-and-drop** onto the dropzone (click-to-browse works; drag events
  aren't wired).

## Images / icons

The JSP references icons under `/resources/img/...` and
`/resources/chatboat-source/...` on the Spring MVC server. This app does
**not** bundle copies — it resolves them at runtime against
`assetBaseUrl` (defaults to `apiBaseUrl`), so as long as this widget is
served from the same MVC app (which it is, per the integration below),
the existing icon files are reused as-is with zero duplication.

