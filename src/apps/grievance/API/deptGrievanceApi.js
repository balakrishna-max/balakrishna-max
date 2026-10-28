import axios from 'axios';

const client = (config) =>
  axios.create({
    baseURL: config.apiUrl,
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });

export const deptGrievanceApi = {
  getCategoryList: (config) =>
    client(config).get('/category/categoryList'),

  createTicket: (config, ticket, file) => {
    const fd = new FormData();
    fd.append('ticket', new Blob([JSON.stringify(ticket)], { type: 'application/json' }));
    if (file) fd.append('file', file);
    return client(config).post('/ticket/createTicket', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getTicketById: (config, ticketId) =>
    client(config).get(`/ticket/getTicketById/${ticketId}`),

  saveCallback: (config, dto) =>
    client(config).post('/callback/saveCallRequest', dto),

  updateCallback: (config, dto) =>
    client(config).put('/callback/updateCallRequest', dto),

  getCallbackByTicketId: (config, ticketId) =>
    client(config).get(`/callback/getByTicketId/${ticketId}`),
};