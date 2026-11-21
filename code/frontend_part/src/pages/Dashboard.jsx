import { useState, useEffect } from "react";
import DashboardSummary from "../components/dashboard/dashboardSummary";
import QuestionCard from "../components/dashboard/questionCard";
import api from "../api";

function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function Dashboard() {
    const [questions, setQuestions] = useState([]);
    const [completedQuestions, setCompletedQuestions] = useState(new Set());

    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                const response = await api.get("/questions");

                const fetchedQuestions = response.data.questions;

                setQuestions(fetchedQuestions);

                const today = getTodayDate();

                setCompletedQuestions(
                    new Set(
                        fetchedQuestions
                            .filter(
                                (question) =>
                                    question.lastRevised &&
                                    new Date(question.lastRevised)
                                        .toISOString()
                                        .slice(0, 10) === today
                            )
                            .map((question) => question._id)
                    )
                );
            } catch (error) {
                console.error("Error fetching questions:", error);
            }
        };

        fetchQuestions();
    }, []);

    const handleRevision = async (question, confidence, notes) => {
        try {
            const response = await api.post(
                `/revisions/${question._id}`,
                {
                    confidence,
                    notes,
                }
            );

            const updatedQuestion = response.data.question;

            setQuestions((previousQuestions) =>
                previousQuestions.map((item) =>
                    item._id === question._id ? updatedQuestion : item
                )
            );

            setCompletedQuestions((previous) => {
                const updated = new Set(previous);
                updated.add(question._id);
                return updated;
            });
        } catch (error) {
            console.error("Error recording revision:", error);
        }
    };

    return (
        <div className="dashboard-page">
            <DashboardSummary />

            {questions.map((question) => (
                <QuestionCard
                    key={question._id}
                    question={question}
                    isCompleted={completedQuestions.has(question._id)}
                    onRevised={handleRevision}
                />
            ))}
        </div>
    );
}

export default Dashboard;