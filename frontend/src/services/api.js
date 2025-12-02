import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_URL,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);

// Classes
export const getClasses = () => api.get('/classes');
export const getAvailableClasses = () => api.get('/classes/available');
export const createClass = (data) => api.post('/classes', data);
export const joinClass = (classId) => api.post(`/classes/${classId}/join`);
export const getClassDetails = (classId) => api.get(`/classes/${classId}`);

// Files
export const uploadFile = (classId, formData) => 
  api.post(`/files/upload/${classId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
export const getClassFiles = (classId) => api.get(`/files/class/${classId}`);
export const getIndexStatus = (classId) => api.get(`/files/class/${classId}/status`);
export const deleteFile = (fileId) => api.delete(`/files/${fileId}`);

// Chat
export const sendMessage = (classId, message) => 
  api.post(`/chat/message/${classId}`, { message });
export const getChatHistory = (classId) => api.get(`/chat/history/${classId}`);

// Users
export const getUsers = () => api.get('/users');
// Authenticated heartbeat to set status; backend uses token to identify user
export const updateUserStatus = (isOnline) => api.post('/users/status', { isOnline });

// Search
export const search = (query) => api.get('/search', { params: { q: query } });

export default api;