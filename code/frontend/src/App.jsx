// Root application router with authentication gating and modular page views.
import { useState } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext.jsx";
import LoginPage from "@/pages/LoginPage.jsx";
import WorkoutPage from "@/pages/WorkoutPage.jsx";
import CalibrationPage from "@/pages/CalibrationPage.jsx";
import DashboardPage from "@/pages/DashboardPage.jsx";
import HistoryPage from "@/pages/HistoryPage.jsx";
import Navbar from "@/components/layout/Navbar.jsx";
import Footer from "@/components/layout/Footer.jsx";

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "dashboard";
    const urlTab = new URLSearchParams(window.location.search).get("tab");
    if (urlTab) return urlTab;
    const storedTab = localStorage.getItem("activeTab");
    if (storedTab) return storedTab;
    return "dashboard";
  });

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem("activeTab", tab);
    } catch (_) {}
  };

  // Mandatory Google OAuth Login Gate.
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="app-shell" data-testid="app-shell">
      <Navbar activeTab={activeTab} onSelectTab={handleSelectTab} />
      <main className="app-main-content">
        {activeTab === "dashboard" && <DashboardPage onNavigate={handleSelectTab} />}
        {activeTab === "workout" && <WorkoutPage onNavigate={handleSelectTab} />}
        {activeTab === "calibration" && <CalibrationPage onNavigate={handleSelectTab} />}
        {activeTab === "history" && <HistoryPage onNavigate={handleSelectTab} />}
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="app-root" data-testid="app-root">
        <AppContent />
      </div>
    </AuthProvider>
  );
}
