import axios from 'axios';

const client = (config) =>
  axios.create({
    baseURL: config.apiUrl,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
  });

export const deptDashboardApi = {
  /* ---------- Tickets ---------- */
  getTickets: (config, {
    status,
    page,
    size,
    search,
    ticketRaisedBy,
    assignedUserIds = [],
    priorities = [],
    fromDate,
    toDate,
  }) => {
    const params = {
      page,
      size,
      search: search || '',
      ticketRaisedBy,
    };

    if (status != null) params.status = status;
    if (assignedUserIds.length > 0) params.assignedUserIds = assignedUserIds;
    if (priorities.length > 0) params.priorities = priorities;
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;

    return client(config).get('/helpdesk/getAllDashBoardTicketsWithFilter', {
      params,
      paramsSerializer: {
        indexes: null,   // serialize arrays as `key=1&key=2`, not `key[]=1`
      },
    });
  },

  /* ---------- Counts ---------- */
  getTicketCounts: (config) =>
    client(config).get('/helpdesk/getAllDashBoardTicketsByUserId', {
      params: { statusFlag: 'S', userId: config.userID },
    }),

  /* ---------- Assigned agents for filter dropdown (kept for future) ---------- */
  getHelpDeskUsers: (config) =>
    client(config).get('/helpdeskuser/list'),

  /* ---------- Single ticket ---------- */
  getTicketById: (config, ticketId) =>
    client(config).get(`/ticket/getTicketById/${ticketId}`),

  /* ---------- Comments ---------- */
  getTicketComments: (config, ticketId) =>
    client(config).get(`/ticket/getTicketCommentByTicketNo/${ticketId}`),

  /* ---------- Create ticket ---------- */
  createTicket: (config, ticket, file) => {
    const fd = new FormData();
    fd.append('ticket', new Blob([JSON.stringify(ticket)], { type: 'application/json' }));
    if (file) fd.append('file', file);
    return client(config).post('/ticket/createTicket', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /* ---------- Categories ---------- */
  getCategories: (config) => client(config).get('/category/categoryList'),

  /* ---------- Feedback ---------- */
  getFeedback: (config, ticketId) =>
    client(config).get(`/feedback/getByTicketId/${ticketId}`),

  saveFeedback: (config, dto) =>
    client(config).post('/feedback/saveOrUpdate', dto),
};