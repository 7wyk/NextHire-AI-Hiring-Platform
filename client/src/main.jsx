import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { Toaster } from 'react-hot-toast'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#ffffff',
            color: '#1c1a17',
            border: '1px solid #e3dfd8',
            borderRadius: '8px',
            boxShadow: '0 1px 2px rgba(28,26,23,0.04), 0 8px 24px -12px rgba(28,26,23,0.16)',
            fontSize: '13px',
            padding: '10px 14px',
          },
          success: { iconTheme: { primary: '#2f6b4f', secondary: '#ffffff' } },
          error: { iconTheme: { primary: '#a33232', secondary: '#ffffff' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)
