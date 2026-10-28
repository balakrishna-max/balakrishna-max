import axiosClient from './axiosClient';

export const userGrievanceApi = {
  /* ---------- Counts ---------- */
  getTicketCounts: (userId) =>
    axiosClient.get('/helpdesk/getAllDashBoardTicketsByUserId', {
      params: { statusFlag: 'S', userId },
    }),

  /* ---------- Tickets (uses the new filter endpoint) ---------- */
  getTickets: ({
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
      status,
    };

    /* Arrays must be sent as repeated query params:
       ?assignedUserIds=1&assignedUserIds=2&priorities=1
       Axios handles this automatically when we pass arrays. */
    if (assignedUserIds.length > 0) params.assignedUserIds = assignedUserIds;
    if (priorities.length > 0) params.priorities = priorities;
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;

    return axiosClient.get('/helpdesk/getAllDashBoardTicketsWithFilter', {
      params,
      paramsSerializer: {
        indexes: null,   // ensures arrays serialize as `key=1&key=2` (no brackets)
      },
    });
  },

  /* ---------- Assigned agents for filter dropdown ---------- */
  getHelpDeskUsers: () => axiosClient.get('/helpdeskuser/list'),

  /* ---------- Single ticket ---------- */
  getTicketById: (id) => axiosClient.get(`/ticket/getTicketById/${id}`),

  /* ---------- Create ticket ---------- */
  createTicket: (ticketData, file) => {
    const formData = new FormData();
    formData.append('ticket', new Blob([JSON.stringify(ticketData)], { type: 'application/json' }));
    if (file) formData.append('file', file);
    return axiosClient.post('/ticket/createTicket', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /* ---------- Categories ---------- */
  getCategories: () => axiosClient.get('/category/categoryList'),

  /* ---------- Comments ---------- */
  getTicketComments: (ticketNo) =>
    axiosClient.get(`/ticket/getTicketCommentByTicketNo/${ticketNo}`),

  /* ---------- Feedback ---------- */
  saveFeedback: (dto) => axiosClient.post('/feedback/saveOrUpdate', dto),
  getFeedback: (ticketId) => axiosClient.get(`/feedback/getByTicketId/${ticketId}`),
};