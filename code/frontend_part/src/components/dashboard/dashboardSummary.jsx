
import { useEffect, useState } from "react";
import api from "../../api";

function DashboardSummary() {
    const [questions, setQuestions] = useState([]);
const [completed, setCompleted] = useState(0);
const [allocated, setAllocated] = useState(0);
const [progress, setProgress] = useState(0);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const response = await api.get("/dashboard/due-today");

                const dashboardData = response.data;

                setQuestions(dashboardData.questions || []);

                setCompleted(dashboardData.completed || 0);
                setAllocated(dashboardData.allocated || 0);
                setProgress(dashboardData.progress || 0);
            } catch (error) {
                console.error("Error loading dashboard:", error);
            }
        };
        loadDashboard();
    }, []);

    

    return (
        <div>
            <div className="summary-card">
                <div className="summary-header">
                    <h1 className="summary-title">
                        Today's Revision Summary
                    </h1>

                    <span className="summary-date">
                        {new Date().toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                        })}
                    </span>
                </div>

                <div className="summary-stats">
                    <div className="stat-box">
                        <p className="stat-label">ALLOCATED</p>
                        <p className="stat-value">{allocated}</p>
                    </div>

                    <div className="stat-box">
                        <p className="stat-label">COMPLETED</p>
                        <p className="stat-value">{completed}</p>
                    </div>

                    <div className="stat-box">
                        <p className="stat-label">PROGRESS</p>
                        <p className="stat-value">{progress}%</p>
                    </div>
                </div>

                <div className="progress-container">
                    <div
                        className="progress-bar"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            <h2 className="recommendations-title">
                Today's Recommendations
            </h2>

            {questions.length === 0 && (
                <div className="recommendations-card">
                    <h3>No questions available</h3>

                    <p>
                        Add some questions to see your recommendations here.
                    </p>
                </div>
            )}
        </div>
    );
}

export default DashboardSummary;
