import { Routes, Route, Navigate } from "react-router-dom";

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
    const isLoggedIn = !!localStorage.getItem("token");

    return (
        <Routes>
            <Route
                path="/login"
                element={
                    isLoggedIn ? <Navigate to="/" replace /> : <Login />
                }
            />

            <Route
                path="/"
                element={
                    isLoggedIn ? <AppLayout /> : <Navigate to="/login" replace />
                }
            >
                <Route index element={<Dashboard />} />
                <Route path="questions" element={<Questions />} />
                <Route path="questions/new" element={<AddQuestion />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="history" element={<History />} />
                <Route path="heatmap" element={<Heatmap />} />
                <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default App;