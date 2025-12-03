import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getClasses, getAvailableClasses, createClass, joinClass, getUsers, updateUserStatus, search } from '../services/api';
import { BookOpen, Plus, Users, LogOut } from 'lucide-react';
import BruinLMLogo from '../components/BruinLMLogo';
import ThemeToggle from '../components/ThemeToggle';

function Hub() {
  const [myClasses, setMyClasses] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', code: '', description: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ classes: [], documents: [] });
  const { user, logout } = useContext(AuthContext);
  const { colors, isDarkMode } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    
    // Send immediate heartbeat to mark as online
    updateUserStatus(true).catch(() => {});
    
    // Send periodic heartbeats every 10 seconds to maintain online status
    const heartbeatInterval = setInterval(() => {
      updateUserStatus(true).catch(() => {});
    }, 10000);
    
    // Much more frequent user list updates for sharper status changes
    const usersInterval = setInterval(loadUsers, 3000); // Update users every 3s instead of 30s
    
    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(usersInterval);
      // Mark as offline when leaving (ignore errors if already logged out)
      updateUserStatus(false).catch(() => {});
    };
  }, []);

  const loadData = async () => {
    try {
      const [classesRes, allClassesRes, usersRes] = await Promise.all([
        getClasses(),
        getAvailableClasses(),
        getUsers()
      ]);
      setMyClasses(classesRes.data);
      setAllClasses(allClassesRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await getUsers();
      setUsers(res.data);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    try {
      await createClass(newClass);
      setShowCreateModal(false);
      setNewClass({ name: '', code: '', description: '' });
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Error creating class');
    }
  };

  const handleJoinClass = async (classId) => {
    try {
      await joinClass(classId);
      setShowJoinModal(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Error joining class');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: colors.primary
    }}>
      {/* Header */}
      <header style={{ 
        background: colors.secondary,
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${colors.border.primary}`, 
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: isDarkMode 
          ? '0 1px 3px rgba(0, 0, 0, 0.3)' 
          : '0 1px 3px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <BruinLMLogo textSize={32} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#10b981'
            }} />
            <p style={{ 
              color: colors.text.primary, 
              fontSize: '0.95rem', 
              fontWeight: '500'
            }}>
              Welcome back, {user?.name}
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ThemeToggle />
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1rem',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '0.85rem',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#dc2626';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ef4444';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', height: 'calc(100vh - 88px)' }}>
        {/* Sidebar - Users */}
        <aside style={{ 
          width: '280px', 
          background: colors.sidebar.background,
          borderRight: `1px solid ${colors.border.primary}`,
          padding: '1.5rem',
          overflowY: 'auto'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1rem', 
            marginBottom: '1.5rem',
            padding: '1rem',
            background: colors.tertiary,
            borderRadius: '8px',
            border: `1px solid ${colors.border.primary}`
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: '#2563eb',
              borderRadius: '8px'
            }}>
              <Users size={18} color="white" />
            </div>
            <h2 style={{ 
              fontSize: '1.1rem', 
              fontWeight: '600',
              color: colors.text.primary
            }}>
              Bruins Online
            </h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {users.map(u => {
              let lastSeenText = '';
              if (!u.is_online && u.last_seen) {
                const last = new Date(u.last_seen);
                const now = new Date();
                const diff = Math.floor((now - last) / 1000);
                if (diff < 10) lastSeenText = `Last seen just now`; // More precise - only 10 seconds
                else if (diff < 60) lastSeenText = `Last seen ${diff}s ago`;
                else if (diff < 3600) lastSeenText = `Last seen ${Math.floor(diff/60)} min ago`;
                else if (diff < 86400) lastSeenText = `Last seen ${Math.floor(diff/3600)} hr ago`;
                else lastSeenText = `Last seen ${Math.floor(diff/86400)} days ago`;
              }
              return (
                <div key={u.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: colors.tertiary,
                  border: `1px solid ${colors.border.primary}`,
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.interactive.hover;
                  e.currentTarget.style.borderColor = colors.border.secondary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.tertiary;
                  e.currentTarget.style.borderColor = colors.border.primary;
                }}
                >
                  <div style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    background: u.is_online ? '#10b981' : '#9ca3af',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    color: 'white'
                  }}>
                    {u.name.charAt(0).toUpperCase()}
                    {u.is_online && (
                      <div style={{
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-2px',
                        width: '10px',
                        height: '10px',
                        background: '#10b981',
                        borderRadius: '50%',
                        border: '2px solid white'
                      }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ 
                      fontSize: '0.9rem', 
                      fontWeight: '500',
                      color: colors.text.primary,
                      marginBottom: '0.25rem'
                    }}>
                      {u.name}
                    </p>
                    <p style={{ 
                      fontSize: '0.75rem', 
                      color: u.is_online ? '#10b981' : colors.text.secondary,
                      fontWeight: '400'
                    }}>
                      {u.is_online ? 'Online' : lastSeenText || 'Offline'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Main Content */}
        <main style={{ 
          flex: 1, 
          padding: '2rem', 
          overflowY: 'auto',
          background: colors.primary
        }}>
          {/* Search Bar */}
          <section style={{ marginBottom: '2rem' }}>
            <input
              type="text"
              placeholder="Search classes or documents..."
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                if (value.length > 1) {
                  search(value)
                    .then(res => setSearchResults(res.data))
                    .catch(() => setSearchResults({ classes: [], documents: [] }));
                } else {
                  setSearchResults({ classes: [], documents: [] });
                }
              }}
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                background: colors.secondary,
                border: `1px solid ${colors.border.primary}`,
                borderRadius: '12px',
                fontSize: '1rem',
                color: colors.text.primary,
                outline: 'none',
                transition: 'all 0.2s ease',
                maxWidth: '600px'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#2563eb';
                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = colors.border.primary;
                e.target.style.boxShadow = 'none';
              }}
            />
          </section>

          {/* Search Results */}
          {searchQuery && searchQuery.length > 1 && (
            <section style={{ marginBottom: '2rem' }}>
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600',
                color: colors.text.primary,
                marginBottom: '1rem'
              }}>
                Search Results
              </h3>
              
              {searchResults.classes.length === 0 && searchResults.documents.length === 0 ? (
                <p style={{ 
                  color: colors.text.secondary, 
                  fontSize: '0.95rem',
                  padding: '1rem',
                  background: colors.secondary,
                  borderRadius: '8px',
                  border: `1px solid ${colors.border.primary}`
                }}>
                  No results found for "{searchQuery}"
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {searchResults.classes.length > 0 && (
                    <div>
                      <h4 style={{ 
                        fontSize: '1rem', 
                        fontWeight: '600',
                        color: colors.text.primary,
                        marginBottom: '0.75rem'
                      }}>
                        Classes ({searchResults.classes.length})
                      </h4>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
                        gap: '1rem' 
                      }}>
                        {searchResults.classes.map(cls => {
                          const isMember = cls.is_member || myClasses.find(mc => mc.id === cls.id);
                          return (
                            <div
                              key={`search-cls-${cls.id}`}
                              style={{
                                background: colors.tertiary,
                                padding: '1.5rem',
                                borderRadius: '12px',
                                border: `1px solid ${colors.border.primary}`,
                                cursor: isMember ? 'pointer' : 'default',
                                transition: 'all 0.2s ease',
                                boxShadow: isDarkMode 
                                  ? '0 1px 3px rgba(0, 0, 0, 0.3)' 
                                  : '0 1px 3px rgba(0, 0, 0, 0.04)'
                              }}
                              onClick={() => {
                                if (isMember) {
                                  navigate(`/class/${cls.id}`);
                                  setSearchQuery('');
                                  setSearchResults({ classes: [], documents: [] });
                                }
                              }}
                              onMouseEnter={(e) => {
                                if (isMember) {
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                  e.currentTarget.style.boxShadow = isDarkMode 
                                    ? '0 8px 25px rgba(0, 0, 0, 0.5)' 
                                    : '0 8px 25px rgba(0, 0, 0, 0.1)';
                                  e.currentTarget.style.borderColor = colors.border.secondary;
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (isMember) {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = isDarkMode 
                                    ? '0 1px 3px rgba(0, 0, 0, 0.3)' 
                                    : '0 1px 3px rgba(0, 0, 0, 0.04)';
                                  e.currentTarget.style.borderColor = colors.border.primary;
                                }
                              }}
                            >
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                marginBottom: '1rem'
                              }}>
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '1rem',
                                  flex: 1
                                }}>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '40px',
                                    height: '40px',
                                    background: '#2563eb',
                                    borderRadius: '10px'
                                  }}>
                                    <BookOpen size={20} color="white" />
                                  </div>
                                  <h3 style={{ 
                                    fontSize: '1.2rem', 
                                    fontWeight: '600',
                                    color: colors.text.primary
                                  }}>
                                    {cls.code}
                                  </h3>
                                </div>
                                {!isMember && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleJoinClass(cls.id);
                                    }}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      background: '#10b981',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      fontWeight: '500',
                                      fontSize: '0.85rem',
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#059669';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = '#10b981';
                                    }}
                                  >
                                    Join
                                  </button>
                                )}
                              </div>
                              <p style={{ 
                                fontSize: '1rem', 
                                color: colors.text.primary, 
                                marginBottom: '0.5rem',
                                fontWeight: '500'
                              }}>
                                {cls.name}
                              </p>
                              {cls.description && (
                                <p style={{ 
                                  fontSize: '0.85rem', 
                                  color: colors.text.secondary,
                                  lineHeight: '1.4'
                                }}>
                                  {cls.description}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {searchResults.documents.length > 0 && (
                    <div>
                      <h4 style={{ 
                        fontSize: '1rem', 
                        fontWeight: '600',
                        color: colors.text.primary,
                        marginBottom: '0.75rem'
                      }}>
                        Documents ({searchResults.documents.length})
                      </h4>
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '0.75rem' 
                      }}>
                        {searchResults.documents.map(doc => (
                          <div
                            key={`search-doc-${doc.id}`}
                            onClick={() => {
                              navigate(`/class/${doc.class_id}`);
                              setSearchQuery('');
                              setSearchResults({ classes: [], documents: [] });
                            }}
                            style={{
                              padding: '1rem',
                              background: colors.secondary,
                              border: `1px solid ${colors.border.primary}`,
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = colors.interactive.hover;
                              e.currentTarget.style.borderColor = colors.border.secondary;
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = colors.secondary;
                              e.currentTarget.style.borderColor = colors.border.primary;
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <p style={{ 
                                fontSize: '0.95rem', 
                                fontWeight: '500',
                                color: colors.text.primary,
                                marginBottom: '0.25rem'
                              }}>
                                {doc.filename}
                              </p>
                              <p style={{ 
                                fontSize: '0.85rem', 
                                color: colors.text.secondary
                              }}>
                                {doc.class_code} – {doc.class_name}
                              </p>
                            </div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '32px',
                              height: '32px',
                              background: '#2563eb',
                              borderRadius: '8px',
                              color: 'white',
                              fontSize: '0.75rem'
                            }}>
                              →
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* My Classes */}
          <section style={{ marginBottom: '2rem', display: searchQuery && searchQuery.length > 1 ? 'none' : 'block' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '1.5rem'
            }}>
              <div>
                <h2 style={{ 
                  fontSize: '1.75rem', 
                  fontWeight: '600',
                  color: colors.text.primary,
                  marginBottom: '0.5rem'
                }}>
                  My Classes
                </h2>
                <p style={{ 
                  color: colors.text.secondary, 
                  fontSize: '0.95rem'
                }}>
                  Manage and access your enrolled courses
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setShowJoinModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1rem',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#059669';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#10b981';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <Plus size={16} />
                  Join Class
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1rem',
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#1d4ed8';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#2563eb';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <Plus size={16} />
                  Create Class
                </button>
              </div>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
              gap: '1rem' 
            }}>
              {myClasses.map(cls => (
                <div
                  key={cls.id}
                  onClick={() => navigate(`/class/${cls.id}`)}
                  style={{
                    background: colors.tertiary,
                    padding: '1.5rem',
                    borderRadius: '12px',
                    border: `1px solid ${colors.border.primary}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isDarkMode 
                      ? '0 1px 3px rgba(0, 0, 0, 0.3)' 
                      : '0 1px 3px rgba(0, 0, 0, 0.04)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = isDarkMode 
                      ? '0 8px 25px rgba(0, 0, 0, 0.5)' 
                      : '0 8px 25px rgba(0, 0, 0, 0.1)';
                    e.currentTarget.style.borderColor = colors.border.secondary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = isDarkMode 
                      ? '0 1px 3px rgba(0, 0, 0, 0.3)' 
                      : '0 1px 3px rgba(0, 0, 0, 0.04)';
                    e.currentTarget.style.borderColor = colors.border.primary;
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem', 
                    marginBottom: '1rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '40px',
                      height: '40px',
                      background: '#2563eb',
                      borderRadius: '10px'
                    }}>
                      <BookOpen size={20} color="white" />
                    </div>
                    <h3 style={{ 
                      fontSize: '1.2rem', 
                      fontWeight: '600',
                      color: colors.text.primary
                    }}>
                      {cls.code}
                    </h3>
                  </div>
                  <p style={{ 
                    fontSize: '1rem', 
                    color: colors.text.primary, 
                    marginBottom: '0.5rem',
                    fontWeight: '500'
                  }}>
                    {cls.name}
                  </p>
                  <p style={{ 
                    fontSize: '0.85rem', 
                    color: colors.text.secondary,
                    lineHeight: '1.4'
                  }}>
                    {cls.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* Create Class Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: colors.primary,
            padding: '2rem',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '480px',
            border: `1px solid ${colors.border.primary}`,
            boxShadow: colors.isDarkMode 
              ? '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)'
              : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: '1rem',
              color: colors.text.primary
            }}>
              Create New Class
            </h2>
            <form onSubmit={handleCreateClass}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '500',
                  color: colors.text.primary,
                  fontSize: '0.9rem'
                }}>
                  Class Code
                </label>
                <input
                  type="text"
                  value={newClass.code}
                  onChange={(e) => setNewClass({ ...newClass, code: e.target.value })}
                  placeholder="e.g., CS 31"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${colors.border.primary}`,
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    background: colors.secondary,
                    color: colors.text.primary,
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#2563eb';
                    e.currentTarget.style.background = colors.tertiary;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = colors.border.primary;
                    e.currentTarget.style.background = colors.secondary;
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '500',
                  color: colors.text.primary,
                  fontSize: '0.9rem'
                }}>
                  Class Name
                </label>
                <input
                  type="text"
                  value={newClass.name}
                  onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                  placeholder="e.g., Introduction to Computer Science"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${colors.border.primary}`,
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    background: colors.secondary,
                    color: colors.text.primary,
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#2563eb';
                    e.currentTarget.style.background = colors.tertiary;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = colors.border.primary;
                    e.currentTarget.style.background = colors.secondary;
                  }}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '500',
                  color: colors.text.primary,
                  fontSize: '0.9rem'
                }}>
                  Description
                </label>
                <textarea
                  value={newClass.description}
                  onChange={(e) => setNewClass({ ...newClass, description: e.target.value })}
                  rows="3"
                  placeholder="Brief description of the class..."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${colors.border.primary}`,
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    background: colors.secondary,
                    color: colors.text.primary,
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    resize: 'vertical',
                    minHeight: '80px'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#2563eb';
                    e.currentTarget.style.background = colors.tertiary;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = colors.border.primary;
                    e.currentTarget.style.background = colors.secondary;
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '0.75rem 1rem',
                    background: colors.secondary,
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    color: colors.text.primary,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.interactive.hover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.secondary;
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.75rem 1rem',
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#1d4ed8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#2563eb';
                  }}
                >
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Class Modal */}
      {showJoinModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: colors.primary,
            padding: '2rem',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '80vh',
            overflow: 'auto',
            border: `1px solid ${colors.border.primary}`,
            boxShadow: colors.isDarkMode 
              ? '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)'
              : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: '1rem',
              color: colors.text.primary
            }}>
              Join a Class
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {allClasses.filter(c => !myClasses.find(mc => mc.id === c.id)).map(cls => (
                <div
                  key={cls.id}
                  style={{
                    padding: '1rem',
                    background: colors.secondary,
                    border: `1px solid ${colors.border.primary}`,
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.interactive.hover;
                    e.currentTarget.style.borderColor = colors.border.secondary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.secondary;
                    e.currentTarget.style.borderColor = colors.border.primary;
                  }}
                >
                  <div>
                    <h3 style={{ 
                      fontWeight: '600', 
                      fontSize: '1rem',
                      color: colors.text.primary,
                      marginBottom: '0.25rem'
                    }}>
                      {cls.code}
                    </h3>
                    <p style={{ 
                      fontSize: '0.85rem', 
                      color: colors.text.secondary,
                      fontWeight: '400'
                    }}>
                      {cls.name}
                    </p>
                  </div>
                  <button
                    onClick={() => handleJoinClass(cls.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '0.85rem',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#059669';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#10b981';
                    }}
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowJoinModal(false)}
              style={{
                marginTop: '1.5rem',
                padding: '0.75rem 1rem',
                background: colors.secondary,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                width: '100%',
                fontWeight: '500',
                color: colors.text.primary,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.interactive.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.secondary;
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Hub;