import React, { useState, useContext } from 'react';
import BruinLMLogo from '../components/BruinLMLogo';
import ThemeToggle from '../components/ThemeToggle';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const { login, register } = useContext(AuthContext);
  const { colors } = useTheme();
  const navigate = useNavigate();

  const validateUCLAEmail = (email) => {
    return email.endsWith('@ucla.edu') || email.endsWith('@g.ucla.edu');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateUCLAEmail(formData.email)) {
      setError('Please use a valid UCLA email (@ucla.edu or @g.ucla.edu)');
      return;
    }
    
    try {
      if (isLogin) {
        await login({ email: formData.email, password: formData.password });
      } else {
        await register(formData);
      }
      navigate('/hub');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: colors.secondary,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
      position: 'relative'
    }}>
      <style>
        {`
          .login-input::placeholder {
            color: ${colors.text.secondary} !important;
            opacity: 0.8;
          }
          .login-input::-webkit-input-placeholder {
            color: ${colors.text.secondary} !important;
            opacity: 0.8;
          }
          .login-input::-moz-placeholder {
            color: ${colors.text.secondary} !important;
            opacity: 0.8;
          }
          .login-input:-ms-input-placeholder {
            color: ${colors.text.secondary} !important;
            opacity: 0.8;
          }
          .login-input:-webkit-autofill {
            -webkit-box-shadow: 0 0 0 1000px ${colors.secondary} inset !important;
            -webkit-text-fill-color: ${colors.text.primary} !important;
            background-color: ${colors.secondary} !important;
          }
          .login-input:-webkit-autofill:focus {
            -webkit-box-shadow: 0 0 0 1000px ${colors.primary} inset !important;
            -webkit-text-fill-color: ${colors.text.primary} !important;
          }
        `}
      </style>
      {/* Theme Toggle */}
      <div style={{ 
        position: 'absolute', 
        top: '2rem', 
        right: '2rem' 
      }}>
        <ThemeToggle />
      </div>

      <div style={{
        width: '100%',
        maxWidth: '440px',
        padding: '3rem',
      }}>
        {/* Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <BruinLMLogo textSize={36} />
          </div>
          <p style={{ 
            color: colors.text.secondary, 
            fontSize: '1.125rem',
            fontWeight: '400'
          }}>
            Collaborative AI for Bruins
          </p>
        </div>

        {/* Form Card */}
        <div style={{
          background: colors.primary,
          borderRadius: '20px',
          padding: '2rem',
          border: `1px solid ${colors.border.primary}`,
          boxShadow: colors.isDarkMode 
            ? '0 4px 20px rgba(0, 0, 0, 0.3)' 
            : '0 4px 20px rgba(0, 0, 0, 0.06)'
        }}>
          {/* Tab Switcher */}
          <div style={{
            display: 'flex',
            background: colors.secondary,
            borderRadius: '12px',
            padding: '4px',
            marginBottom: '2rem'
          }}>
            <button
              onClick={() => {
                setIsLogin(true);
                setError('');
              }}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: isLogin ? colors.primary : 'transparent',
                color: isLogin ? colors.text.primary : colors.text.secondary,
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.9375rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isLogin ? (colors.isDarkMode 
                  ? '0 2px 8px rgba(0, 0, 0, 0.3)' 
                  : '0 2px 8px rgba(0, 0, 0, 0.08)') : 'none'
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setError('');
              }}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: !isLogin ? colors.primary : 'transparent',
                color: !isLogin ? colors.text.primary : colors.text.secondary,
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.9375rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: !isLogin ? (colors.isDarkMode 
                  ? '0 2px 8px rgba(0, 0, 0, 0.3)' 
                  : '0 2px 8px rgba(0, 0, 0, 0.08)') : 'none'
              }}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div style={{ 
              background: '#fff2f0', 
              color: '#d32f2f', 
              padding: '1rem', 
              borderRadius: '12px',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
              border: '1px solid #ffcdd2'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  color: colors.text.primary
                }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="login-input"
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    background: colors.secondary,
                    border: '1px solid transparent',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    color: colors.text.primary,
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.background = colors.primary;
                    e.target.style.borderColor = '#2563eb';
                    e.target.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.background = colors.secondary;
                    e.target.style.borderColor = 'transparent';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '500',
                fontSize: '0.875rem',
                color: colors.text.primary
              }}>
                UCLA Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="bruin@ucla.edu"
                required
                className="login-input"
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  background: colors.secondary,
                  border: '1px solid transparent',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  color: colors.text.primary,
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.background = colors.primary;
                  e.target.style.borderColor = '#2563eb';
                  e.target.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.background = colors.secondary;
                  e.target.style.borderColor = 'transparent';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '500',
                fontSize: '0.875rem',
                color: colors.text.primary
              }}>
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="login-input"
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  background: colors.secondary,
                  border: '1px solid transparent',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  color: colors.text.primary,
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.background = colors.primary;
                  e.target.style.borderColor = '#2563eb';
                  e.target.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.background = colors.secondary;
                  e.target.style.borderColor = 'transparent';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '1rem',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 2px 8px rgba(37, 99, 235, 0.3)';
              }}
            >
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p style={{ 
          textAlign: 'center', 
          marginTop: '2rem',
          color: colors.text.secondary,
          fontSize: '0.875rem'
        }}>
          UCLA students only • Secure & Private
        </p>
      </div>
    </div>
  );
}

export default Login;