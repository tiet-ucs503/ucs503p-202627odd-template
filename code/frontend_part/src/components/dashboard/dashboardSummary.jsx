import { useEffect, useState } from "react";
import api from "../../api";

function DashboardSummary() {
    const [questions, setQuestions] = useState([]);
    const [completedIds, setCompletedIds] = useState([]);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const response = await api.get("/dashboard/due-today");

                const dashboardData = response.data;

                setQuestions(dashboardData.questions || []);

                setCompletedIds(
                    (dashboardData.questions || [])
                        .filter((question) => question.lastRevised)
                        .map((question) => question._id)
                );
            } catch (error) {
                console.error("Error loading dashboard:", error);
            }
        };

        loadDashboard();
    }, []);

    const allocated = questions.length;

    const completed = questions.filter((question) =>
        completedIds.includes(question._id)
    ).length;

    const progress =
        allocated === 0
            ? 0
            : Math.round((completed / allocated) * 100);

    return (
        <div>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h1 className="text-2xl font-bold mb-4">
                    Today's Revision Summary [
                    {new Date().toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                    })}
                    ]
                </h1>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <p className="text-sm text-gray-500">Allocated</p>
                        <p className="text-3xl font-bold">{allocated}</p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500">Completed</p>
                        <p className="text-3xl font-bold">{completed}</p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500">Progress</p>
                        <p className="text-3xl font-bold">{progress}%</p>
                    </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2 mt-5">
                    <div
                        className="bg-[#315B8C] h-2 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            <h2 className="text-xl font-semibold mb-4">
                Today's Recommendations
            </h2>

            {questions.length === 0 && (
                <div className="bg-white rounded-lg shadow p-6 text-center">
                    <h3 className="text-lg font-semibold text-gray-700">
                        No questions available
                    </h3>

                    <p className="text-gray-500 mt-2">
                        Add some questions to see your recommendations here.
                    </p>
                </div>
            )}
        </div>
    );
}

export default DashboardSummary;