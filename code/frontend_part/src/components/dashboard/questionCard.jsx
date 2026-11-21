
import { useState } from "react";
import RevisionModal from "./revisionModel";

function QuestionCard({ question, isCompleted, onRevised }) {
    const [isEditing, setIsEditing] = useState(false);

    const handleRevision = (confidence, notes) => {
        onRevised(question, confidence, notes);
        setIsEditing(false);
    };

    return (
        <div className="bg-white rounded-lg shadow p-5 mb-4">
            <div className="flex justify-between items-start gap-4">
                <div className="min-w-0">
                    <h2 className="text-xl font-semibold">
                        {question.link ? (
                            <a
                                href={question.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#4d6a47] font-medium hover:underline"
                            >
                                {question.title}
                            </a>
                        ) : (
                            question.title
                        )}
                    </h2>

                    <p className="text-gray-500">
                        {question.topic}
                        {question.subtopic && ` • ${question.subtopic}`}
                    </p>

                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                        <span>{question.difficulty}</span>

                        <span>{question.platform}</span>

                        <span className="font-bold text-gray-800">
                            Confidence {question.confidence ?? 3}/5
                        </span>

                        <span>
                            Last revised:{" "}
                            {question.lastRevised
                                ? new Date(
                                      question.lastRevised
                                  ).toLocaleDateString("en-IN", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                  })
                                : "Not yet revised"}
                        </span>

                        <span className="font-medium text-[#5f7f58]">
                            Next revision:{" "}
                            {question.nextRevision
                                ? new Date(
                                      question.nextRevision
                                  ).toLocaleDateString("en-IN", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                  })
                                : "Not scheduled"}
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className={`shrink-0 min-w-28 text-center font-medium text-white px-4 py-2 rounded-md shadow ${
                        isCompleted
                            ? "bg-green-700 hover:bg-green-800"
                            : "bg-[#5f7f58] hover:bg-[#4d6a47]"
                    }`}
                >
                    {isCompleted ? "Revised ✓" : "Revise"}
                </button>
            </div>

            {isEditing && (
                <RevisionModal
                    question={question}
                    onClose={() => setIsEditing(false)}
                    onSave={handleRevision}
                />
            )}
        </div>
    );
}

export default QuestionCard;
