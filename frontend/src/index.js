import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

try {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  
  // Add error handler for React errors
  window.addEventListener('error', (event) => {
    console.error('React Error:', event.error);
    // Show error in the UI
    document.body.innerHTML = `
      <div style="padding: 20px; color: red;">
        <h2>Something went wrong</h2>
        <pre>${event.error?.message || 'Unknown error'}</pre>
        <p>Check the browser console (F12) for more details.</p>
      </div>
    `;
  });

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (err) {
  console.error('Failed to start app:', err);
  document.body.innerHTML = `
    <div style="padding: 20px; color: red;">
      <h2>Failed to start app</h2>
      <pre>${err.message}</pre>
      <p>Check the browser console (F12) for more details.</p>
    </div>
  `;
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
