/**
 * API service module for making HTTP requests to the backend
 * Handles authentication, file uploads, chat, and class management
 */

import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

/**
 * Axios instance configured with base URL
 */
const api = axios.create({
  baseURL: API_URL,
});

/**
 * Request interceptor to automatically add JWT token to all API requests
 */
api.interceptors.request.use((requestConfig) => {
  const authToken = localStorage.getItem('token');
  if (authToken) {
    requestConfig.headers.Authorization = `Bearer ${authToken}`;
  }
  return requestConfig;
});

// ========== Authentication API Functions ==========

/** Register a new user account */
export const register = (userData) => api.post('/auth/register', userData);

/** Log in an existing user */
export const login = (credentials) => api.post('/auth/login', credentials);

/** Log out the current user */
export const logout = () => api.post('/auth/logout');

// ========== Class Management API Functions ==========

/** Get all classes for the current user */
export const getClasses = () => api.get('/classes');

/** Get classes available for the user to join */
export const getAvailableClasses = () => api.get('/classes/available');

/** Create a new class */
export const createClass = (classData) => api.post('/classes', classData);

/** Join a class by ID */
export const joinClass = (classId) => api.post(`/classes/${classId}/join`);

/** Get detailed information about a specific class */
export const getClassDetails = (classId) => api.get(`/classes/${classId}`);

// ========== File Management API Functions ==========

/** Upload a file to a class */
export const uploadFile = (classId, formData) =>
  api.post(`/files/upload/${classId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

/** Get all files for a specific class */
export const getClassFiles = (classId) => api.get(`/files/class/${classId}`);

/** Get indexing status for files in a class */
export const getIndexStatus = (classId) => api.get(`/files/class/${classId}/status`);

/** Delete a file by ID */
export const deleteFile = (fileId) => api.delete(`/files/${fileId}`);

// ========== Chat API Functions ==========

/** Send a chat message to a class */
export const sendMessage = (classId, messageContent) =>
  api.post(`/chat/message/${classId}`, { message: messageContent });

/** Get chat history for a specific class */
export const getChatHistory = (classId) => api.get(`/chat/history/${classId}`);

// ========== User API Functions ==========

/** Get list of all users */
export const getUsers = () => api.get('/users');

/** Update user online status (authenticated heartbeat) */
export const updateUserStatus = (isOnline) => api.post('/users/status', { isOnline });

// ========== Search API Functions ==========

/** Search across classes, files, and chat messages */
export const search = (searchQuery) => api.get('/search', { params: { q: searchQuery } });

export default api;