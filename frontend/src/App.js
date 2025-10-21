import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Hub from './pages/Hub';
import ClassRoom from './pages/ClassRoom';

// Protected Route Component
function ProtectedRoute({ children }) {
  const { token, loading } = useContext(AuthContext);
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        Loading...
      </div>
    );
  }
  
  return token ? children : <Navigate to="/" />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route 
              path="/hub" 
              element={
                <ProtectedRoute>
                  <Hub />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/class/:classId" 
              element={
                <ProtectedRoute>
                  <ClassRoom />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
