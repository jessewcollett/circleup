
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
console.log('[bootstrap] index.tsx loaded');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
console.log('[bootstrap] React root created');
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
console.log('[bootstrap] React render called');
