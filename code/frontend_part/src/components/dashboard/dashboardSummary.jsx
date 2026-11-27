
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

                const dailyTarget =
    Number(localStorage.getItem("algoRecallDailyTarget")) || 3;

const allocated = Math.min(
    dashboardData.allocated || 0,
    dailyTarget
);

const completed = Math.min(
    dashboardData.completed || 0,
    dailyTarget
);

const progress =
    allocated === 0
        ? 0
        : Math.min(
              100,
              Number(((completed / allocated) * 100).toFixed(1))
          );

setQuestions(
    (dashboardData.questions || []).slice(0, dailyTarget)
);

setAllocated(allocated);
setCompleted(completed);
setProgress(progress);
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
