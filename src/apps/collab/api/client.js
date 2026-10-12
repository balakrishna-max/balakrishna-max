import axios from 'axios';
import { APP_BASE_URL } from '../../../config/commonURLConstants.js';

export const DEFAULT_API_BASE_URL = APP_BASE_URL;

let runtimeBaseUrl = DEFAULT_API_BASE_URL;

export function setApiBaseUrl(url) {
  runtimeBaseUrl = url || DEFAULT_API_BASE_URL;
  client.defaults.baseURL = runtimeBaseUrl;
}

export const client = axios.create({
  baseURL: runtimeBaseUrl,
  withCredentials: true,
});

export function setAuthToken(token) {
  if (token) client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  else delete client.defaults.headers.common['Authorization'];
}

client.interceptors.response.use(
  (response) => {
    const contentType = response.headers?.['content-type'] || '';
    if (typeof response.data === 'string' && contentType.includes('text/html')) {
      const err = new Error('Server returned an error page instead of data.');
      err.isServerErrorPage = true;
      err.rawResponse = response;
      return Promise.reject(err);
    }
    return response;
  },
  (error) => {
    const contentType = error.response?.headers?.['content-type'] || '';
    if (contentType.includes('text/html')) {
      error.isServerErrorPage = true;
    }
    return Promise.reject(error);
  }
);

const ctx = (params) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));

const form = (params) => new URLSearchParams(ctx(params));

export const getSubUsers = (UserId) => client.get('subUsersDetails', { params: { UserId } });
export const getUsersByDepartment = (nDepartmentID, sSearchText) =>
  client.get('getuserdetailsByDepartId.html', { params: ctx({ nDepartmentID, sSearchText }) });


export const getTabUnreadCounts = () => client.get('getRecvdCount.html');
export const getHeaderUnreadNotifications = (userId) =>
  client.get('getUnreadNotifications', { params: { userId } });
export const updateUnreadCountByType = (userId, messageType) =>
  client.post('updateUnreadCountByType', form({ userId, messageType }));

export const getChatConversationList = (tenderId, moduleId) =>
  client.get('getChatConversationList.html', { params: ctx({ tenderId, moduleId }) });
export const getSingleUserChat = (tenderId, singleselected, moduleId) =>
  client.get('getsingleuserdetails.html', { params: ctx({ tenderId, singleselected, moduleId }) });
export const getMultiUserChat = (tenderId, multiUserIds, moduleId) =>
  client.get('getmultichatdetails.html', { params: ctx({ tenderId, multiUserIds, moduleId }) });
export const sendSingleChatMessage = (payload) => client.post('saveSingleChatdetails.html', form(payload));
export const sendGroupChatMessage = (payload) => client.post('savemultiuserdetails.html', form(payload));
export const markChatRead = (primaryId, tenderId) => client.post('updateChatDetails.html', form({ primaryId, tenderId }));
export const pollSingleChatUpdate = () => client.get('getChatUpdate.html');
export const pollGroupChatUpdate = () => client.get('getGroupChatUpdate.html');



export const saveMeetingInvitation = (meetingDetails) =>
  client.post('saveMeetingInvitationDetails.html', form({ meatData: JSON.stringify(meetingDetails) }));
export const getMeetings = (filterType, tenderId, pageNo, moduleId) => {
  const url = filterType === 'sent' ? 'getSharedMeetingInvitationDetails.html' : 'getMeetingInvitationDetails.html';
  return client.get(url, { params: ctx({ tenderId, pageNo, moduleId }) });
};
export const markMeetingRead = (primaryId) => client.post('updateInvitationDetails.html', form({ primaryId }));


export const sendEmail = (payload) => client.post('sendSmsOrEmail.html', form(payload));
export const getEmails = (filterType, tenderId, pageNo, moduleId) => {
  const url = filterType === 'sent' ? 'getSharedEMailDetails.html' : 'getEMailDetails.html';
  return client.get(url, { params: ctx({ tenderId, pageNo, moduleId }) });
};
export const markEmailRead = (communType, primaryId) =>
  client.post('updateEmailDetails.html', form({ communType, primaryId }));

export const shareDocument = (formData) =>
  client.post('shareDocAjax.html', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const getShareDocs = (filterType, tenderId, pageNo, moduleId) => {
  const url = filterType === 'sent' ? 'getreceivedocdetails.html' : 'getsharedocdetails.html';
  return client.get(url, { params: ctx({ tenderId, pageNo, moduleId }) });
};

export const downloadCollabFile = (filePath) => {
  if (!filePath) {
    return Promise.reject(new Error('File path is missing'));
  }

  const encodedFilePath = encodeURIComponent(filePath);

  const params = new URLSearchParams();
  params.append('filePath', encodedFilePath);
  
  return client.post('downloadCollabFile', params, {
    responseType: 'blob',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
};

export function triggerBlobDownload(blob, fallbackName, contentDisposition) {
  let fileName = fallbackName || 'download';
  if (contentDisposition && contentDisposition.indexOf('filename=') !== -1) {
    fileName = contentDisposition.split('filename=')[1].replace(/"/g, '');
  }
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}


