# TravelSphere Frontend Setup Script (BOM-safe version)
# Run from: TravelSphere\frontend\
# Usage:    .\setup.ps1

Write-Host "Setting up TravelSphere frontend..." -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# Create directory structure
# ---------------------------------------------------------------------------
New-Item -ItemType Directory -Force -Path "src\api"        | Out-Null
New-Item -ItemType Directory -Force -Path "src\components" | Out-Null
New-Item -ItemType Directory -Force -Path "src\pages"      | Out-Null
New-Item -ItemType Directory -Force -Path "public"         | Out-Null

# ---------------------------------------------------------------------------
# package.json
# ---------------------------------------------------------------------------
Write-Host "Creating package.json..."
[System.IO.File]::WriteAllText("$PWD\package.json", @'
{
  "name": "travelsphere-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.7.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.24.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.3.4"
  }
}
'@)

# ---------------------------------------------------------------------------
# vite.config.js
# ---------------------------------------------------------------------------
Write-Host "Creating vite.config.js..."
[System.IO.File]::WriteAllText("$PWD\vite.config.js", @'
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8000',
          changeOrigin: true,
        },
        '/uploads': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  };
});
'@)

# ---------------------------------------------------------------------------
# index.html
# ---------------------------------------------------------------------------
Write-Host "Creating index.html..."
[System.IO.File]::WriteAllText("$PWD\index.html", @'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TravelSphere</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
'@)

# ---------------------------------------------------------------------------
# .env.example
# ---------------------------------------------------------------------------
Write-Host "Creating .env.example..."
[System.IO.File]::WriteAllText("$PWD\.env.example", @'
# Copy this file to .env and fill in your values.
# Do NOT commit .env to version control.

# Base URL of the TravelSphere FastAPI backend.
# In development, Vite proxy handles /api requests automatically.
VITE_API_BASE_URL=http://localhost:8000
'@)

# ---------------------------------------------------------------------------
# .gitignore
# ---------------------------------------------------------------------------
Write-Host "Creating .gitignore..."
[System.IO.File]::WriteAllText("$PWD\.gitignore", @'
# Dependencies
node_modules/

# Build output
dist/

# Local environment variables - never commit real secrets
.env
.env.local
.env.*.local

# Editor / OS
.DS_Store
Thumbs.db
.vscode/
.idea/
'@)

# ---------------------------------------------------------------------------
# src/main.jsx
# ---------------------------------------------------------------------------
Write-Host "Creating src/main.jsx..."
[System.IO.File]::WriteAllText("$PWD\src\main.jsx", @'
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
'@)

# ---------------------------------------------------------------------------
# src/App.jsx
# ---------------------------------------------------------------------------
Write-Host "Creating src/App.jsx..."
[System.IO.File]::WriteAllText("$PWD\src\App.jsx", @'
// App.jsx - Root component (placeholder until routing is wired up in Chunk 1)
function App() {
  return (
    <div className="app-placeholder">
      <h1>🌍 TravelSphere</h1>
      <p>Frontend is running. Authentication coming in Chunk 1.</p>
    </div>
  );
}

export default App;
'@)

# ---------------------------------------------------------------------------
# src/App.css
# ---------------------------------------------------------------------------
Write-Host "Creating src/App.css..."
[System.IO.File]::WriteAllText("$PWD\src\App.css", @'
/* Minimal base styles - no UI framework yet */

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background-color: #f5f5f5;
  color: #1a1a1a;
  min-height: 100vh;
}

.app-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 1rem;
}

.app-placeholder h1 {
  font-size: 2rem;
}

.app-placeholder p {
  color: #555;
}
'@)

# ---------------------------------------------------------------------------
# src/api/client.js
# ---------------------------------------------------------------------------
Write-Host "Creating src/api/client.js..."
[System.IO.File]::WriteAllText("$PWD\src\api\client.js", @'
/**
 * client.js - Centralized API communication layer for TravelSphere.
 *
 * All backend requests go through this module.
 *
 * - axios instance pre-configured with base URL and default headers.
 * - Request interceptor attaches the JWT Bearer token on every request.
 * - Response interceptor handles errors globally (extended in Chunk 1).
 *
 * Do not call axios directly from pages or components.
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : '/api';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach JWT token if present
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - global error handling
// Chunk 1 will extend this to redirect to /login on 401.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
'@)

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "All files created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. npm install"
Write-Host "  2. npm run dev"
Write-Host "  3. Open http://localhost:5173"