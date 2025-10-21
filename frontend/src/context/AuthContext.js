import React, { createContext, useState, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, updateUserStatus } from '../services/api';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      const storedUser = localStorage.getItem('user');
      try {
        if (token) {
          // Validate token and refresh user from server
          const me = await api.get('/users/me');
          localStorage.setItem('user', JSON.stringify(me.data));
          setUser(me.data);
          // Notify server: online
          await updateUserStatus(true);
        } else if (storedUser) {
          // No token => clear stale user
          localStorage.removeItem('user');
        }
      } catch (err) {
        // Invalid token -> clean up
        console.warn('Auth bootstrap failed, clearing session', err?.response?.data || err.message);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();

    // Set user offline on window close
    const handleBeforeUnload = () => {
      if (token) {
        updateUserStatus(false);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [token]);

  // Heartbeat to keep presence fresh while logged in
  useEffect(() => {
    if (!token) return;
    let intervalId;
    const beat = async () => {
      try { await updateUserStatus(true); } catch (e) { /* non-fatal */ }
    };
    // initial beat and then interval
    beat();
    intervalId = setInterval(beat, 30000); // every 30s

    // On tab focus, do an immediate beat
    const onVisibility = () => {
      if (document.visibilityState === 'visible') beat();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [token]);

  const login = async (credentials) => {
    try {
      console.debug('AuthContext: login request', credentials.email);
      const response = await apiLogin(credentials);
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setToken(token);
      setUser(user);
      await updateUserStatus(true);
    } catch (err) {
      console.error('AuthContext login error:', err);
      // Ensure the thrown error retains a response.data.error when possible
      if (!err.response) {
        const e = new Error(err.message || 'Authentication failed');
        e.response = { data: { error: err.message || 'Authentication failed' } };
        throw e;
      }
      throw err;
    }
  };

  const register = async (credentials) => {
    try {
      console.debug('AuthContext: register request', credentials.email);
      const response = await apiRegister(credentials);
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setToken(token);
      setUser(user);
      await updateUserStatus(true);
    } catch (err) {
      console.error('AuthContext register error:', err);
      if (!err.response) {
        const e = new Error(err.message || 'Authentication failed');
        e.response = { data: { error: err.message || 'Authentication failed' } };
        throw e;
      }
      throw err;
    }
  };

  const logout = async () => {
    await updateUserStatus(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};