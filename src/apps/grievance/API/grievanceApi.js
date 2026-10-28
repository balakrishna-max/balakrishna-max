import axiosClient from './axiosClient';

export const grievanceApi = {
  getCategories: () => axiosClient.get('/category/categoryList'),
  
  createTicket: (ticketData, file) => {
    const formData = new FormData();
    // JSP expects "ticket" as a Blob with application/json
    formData.append('ticket', new Blob([JSON.stringify(ticketData)], { type: 'application/json' }));
    if (file) {
      formData.append('file', file);
    }
    return axiosClient.post('/ticket/createTicket', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  getTicketById: (ticketId) => axiosClient.get(`/ticket/getTicketById/${ticketId}`),
  
  saveCallback: (dto) => axiosClient.post('/callback/saveCallRequest', dto),
  updateCallback: (dto) => axiosClient.put('/callback/updateCallRequest', dto),
  getCallbackByTicketId: (ticketId) => axiosClient.get(`/callback/getByTicketId/${ticketId}`),



   // Admin: get paginated tickets
  getTicketsByStatus: ({ status, flag, page, size }) => {
    return axiosClient.get('/helpdesk/getTicketsByStatus', {
      params: { status, flag, page, size }
    });
  },

  // Admin: update ticket
  updateTicket: (ticketId, payload) => {
    return axiosClient.put(`/ticket/updateTicket/${ticketId}`, payload);
  },

  // Admin: fetch master data (status/priority)
  fetchMaster: (categoryCode) => {
    return axiosClient.post('/master/mdata', { categoryCode });
  },

  // Admin: comments
  getTicketComments: (ticketId) =>
    axiosClient.get(`/ticket/getTicketCommentByTicketNo/${ticketId}`),

  // Admin: SLA history
  getTicketHistoryByNumber: (ticketNumber) =>
    axiosClient.get('/ticketHistory/getAllHistoryTicketsByTicketNo', {
      params: { ticketNumber }
    }),
};