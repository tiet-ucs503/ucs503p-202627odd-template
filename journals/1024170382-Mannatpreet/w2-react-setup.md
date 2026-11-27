# Week 2: React Project Setup and Routing

# Frontend Structure and Routing

## Objective

The main objective of the second week was to start the frontend development of Algo Recall. After completing the initial project planning, I started setting up the React application, organizing its files, and configuring the routes for the different pages of the application.

## Relevant Context

I cloned the GitHub repository that had been forked by my friend to my local system. After that, I started working on the frontend inside the `code/frontend_part/` directory.

The initial folder structure was organized to keep the different parts of the application separate. The main structure was as follows:

frontend_part/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   ├── App.jsx
│   ├── main.jsx
│   ├── App.css
│   └── index.css
├── package.json
├── package-lock.json
└── vite.config.js

The `pages` folder was used to organize the different application pages, while the `components` folder was meant for reusable interface elements. The `layouts` folder provided a place for the common layout shared by the main application pages.

## Routing Implementation

For navigation between different pages, I used React Router DOM. In `main.jsx`, I wrapped the application inside `BrowserRouter`, which enabled client-side routing.

The relevant code was:

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

In `App.jsx`, I used `Routes` and `Route` to define the paths for the different pages.

```jsx
import { Routes, Route } from "react-router-dom";

import AppLayout from "./layouts/appLayout";

import Dashboard from "./pages/Dashboard";
import Questions from "./pages/Questions";
import AddQuestion from "./pages/addQuestion";
import Analytics from "./pages/Analytics";
import History from "./pages/History";
import Heatmap from "./pages/Heatmap";
import Settings from "./pages/Settings";
import Login from "./pages/Login";

function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/questions" element={<Questions />} />
                <Route path="/questions/new" element={<AddQuestion />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/history" element={<History />} />
                <Route path="/heatmap" element={<Heatmap />} />
                <Route path="/settings" element={<Settings />} />
            </Route>
        </Routes>
    );
}

export default App;
```

The main application pages were grouped under `AppLayout`, while the Login page was kept separate. This established the basic routing structure for the application and made it easier to organize the different sections.

## Key Observations

While working on the initial setup, I understood that organizing the frontend properly would make further development easier. Separating pages, components, and layouts would help keep the code manageable as more features were added.

I also started considering the basic dimensions of the Navbar, including its width and height, as part of the initial interface planning. However, the actual implementation of the interface and the functionality of the individual pages were still to be developed.

## Outcome

By the end of the second week, I had cloned the project repository, organized the initial React frontend structure, and configured routes for the main pages of Algo Recall. I had also decided on the initial width and height of the Navbar.

This work provided the basic foundation for the next stage of development, where I could begin implementing the dashboard and the application's core features.