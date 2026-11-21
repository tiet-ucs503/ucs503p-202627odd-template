import { useState, useEffect } from "react";
import { Pencil, Trash2 } from "lucide-react";
import api from "../api";

function Questions() {
    const [questions, setQuestions] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [selectedNotes, setSelectedNotes] = useState(null);

    useEffect(() => {
        const loadQuestions = async () => {
            try {
                const response = await api.get("/questions");
                setQuestions(response.data.questions);
            } catch (error) {
                console.error("Error loading questions:", error);
                setQuestions([]);
            }
        };

        loadQuestions();
    }, []);

    const formatDate = (dateValue) => {
        if (!dateValue) return "-";

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) return "-";

        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const handleEdit = (question) => {
        setEditingId(question._id);
        setEditForm({ ...question });
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;

        setEditForm((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleUpdate = async (e) => {
        e.preventDefault();

        try {
            const response = await api.put(`/questions/${editingId}`, {
                title: editForm.title,
                topic: editForm.topic,
                subtopic: editForm.subtopic,
                difficulty: editForm.difficulty,
                link: editForm.link,
                confidence: Number(editForm.confidence),
                dateSolved: editForm.dateSolved,
                notes: editForm.notes,
            });

            setQuestions((prev) =>
                prev.map((question) =>
                    question._id === editingId
                        ? response.data.question
                        : question
                )
            );

            setEditingId(null);
            setEditForm({});
        } catch (error) {
            console.error("Error updating question:", error);
            alert("Unable to update question. Please try again.");
        }
    };

    const handleDelete = async (id) => {
        const confirmed = window.confirm(
            "Are you sure you want to delete this question?"
        );

        if (!confirmed) return;

        try {
            await api.delete(`/questions/${id}`);

            setQuestions((prev) =>
                prev.filter((question) => question._id !== id)
            );

            if (editingId === id) {
                setEditingId(null);
                setEditForm({});
            }

            if (selectedNotes?._id === id) {
                setSelectedNotes(null);
            }
        } catch (error) {
            console.error("Error deleting question:", error);
            alert("Unable to delete question. Please try again.");
        }
    };

    const closeEditForm = () => {
        setEditingId(null);
        setEditForm({});
    };

    return (
        <div className="p-6 max-w-full overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-800">
                        My Questions
                    </h1>

                    <p className="text-gray-500 mt-1">
                        Manage and review your solved DSA questions.
                    </p>
                </div>

                <div className="self-start bg-[#5f7f58]/10 text-[#5f7f58] px-4 py-2 rounded-lg font-medium">
                    Total Questions: {questions.length}
                </div>
            </div>

            {questions.length === 0 ? (
                <div className="bg-white rounded-xl shadow-md p-10 text-center">
                    <h2 className="text-xl font-medium text-gray-700 mb-2">
                        No questions added yet
                    </h2>

                    <p className="text-gray-500">
                        Visit the Add Question page to add your first question.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-md overflow-x-hidden">
                    <table className="w-full table-fixed text-left text-sm border-collapse">
                        <thead className="bg-gray-100 text-gray-700">
                            <tr>
                                <th className="p-3 w-[17%]">Question</th>
                                <th className="p-3 w-[11%]">Topic</th>
                                <th className="p-3 w-[10%]">Subtopic</th>
                                <th className="p-3 w-[9%]">Difficulty</th>
                                <th className="p-3 w-[8%]">Confidence</th>
                                <th className="p-3 w-[10%]">Date Solved</th>
                                <th className="p-3 w-[11%]">Last Revised</th>
                                <th className="p-3 w-[9%]">Notes</th>
                                <th className="p-3 w-[15%]">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {questions.map((question) => (
                                <tr
                                    key={question._id}
                                    className="border-t hover:bg-gray-50"
                                >
                                    <td className="p-3 font-medium text-gray-800 break-words">
                                        {question.link ? (
                                            <a
                                                href={question.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[#5f7f58] hover:underline"
                                            >
                                                {question.title}
                                            </a>
                                        ) : (
                                            question.title
                                        )}
                                    </td>

                                    <td className="p-3 break-words">
                                        {question.topic || "-"}
                                    </td>

                                    <td className="p-3 break-words">
                                        {question.subtopic || "-"}
                                    </td>

                                    <td className="p-3">
                                        <span
                                            className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                                question.difficulty === "Easy"
                                                    ? "bg-green-100 text-green-700"
                                                    : question.difficulty === "Medium"
                                                      ? "bg-yellow-100 text-yellow-700"
                                                      : "bg-red-100 text-red-700"
                                            }`}
                                        >
                                            {question.difficulty}
                                        </span>
                                    </td>

                                    <td className="p-3 font-semibold">
                                        {question.confidence ?? 3}/5
                                    </td>

                                    <td className="p-3 break-words">
                                        {formatDate(question.dateSolved)}
                                    </td>

                                    <td className="p-3 break-words">
                                        {formatDate(question.lastRevised)}
                                    </td>

                                    <td className="p-3">
                                        {question.notes ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedNotes(question)
                                                }
                                                className="text-[#5f7f58] font-medium hover:underline"
                                            >
                                                View Notes
                                            </button>
                                        ) : (
                                            <span className="text-gray-400">
                                                -
                                            </span>
                                        )}
                                    </td>

                                    <td className="p-3">
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() =>
                                                    handleEdit(question)
                                                }
                                                className="text-[#5f7f58] hover:text-[#4d6a47] p-2 rounded"
                                                title="Update"
                                            >
                                                <Pencil size={18} />
                                            </button>

                                            <button
                                                onClick={() =>
                                                    handleDelete(question._id)
                                                }
                                                className="text-red-600 hover:text-red-800 p-2 rounded"
                                                title="Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {selectedNotes && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
                    onClick={() => setSelectedNotes(null)}
                >
                    <div
                        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start gap-4 mb-4">
                            <div className="min-w-0">
                                <h2 className="text-xl font-semibold text-gray-800">
                                    Notes / Mistakes
                                </h2>

                                <p className="text-sm text-gray-500 mt-1 break-words">
                                    {selectedNotes.title}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedNotes(null)}
                                className="text-gray-500 hover:text-gray-800 text-2xl leading-none"
                                aria-label="Close notes"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 text-gray-700 whitespace-pre-wrap break-words max-h-72 overflow-y-auto">
                            {selectedNotes.notes}
                        </div>

                        <div className="flex justify-end mt-5">
                            <button
                                type="button"
                                onClick={() => setSelectedNotes(null)}
                                className="bg-[#5f7f58] text-white px-5 py-2 rounded-lg hover:bg-[#4d6a47] transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingId !== null && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto"
                    onClick={closeEditForm}
                >
                    <div
                        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-3xl my-8"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-2xl font-semibold mb-6">
                            Update Question
                        </h2>

                        <form
                            onSubmit={handleUpdate}
                            className="grid grid-cols-1 md:grid-cols-2 gap-4"
                        >
                            <div>
                                <label className="block mb-1 font-medium">
                                    Question Title *
                                </label>

                                <input
                                    type="text"
                                    name="title"
                                    value={editForm.title || ""}
                                    onChange={handleEditChange}
                                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5f7f58]"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block mb-1 font-medium">
                                    Topic *
                                </label>

                                <input
                                    type="text"
                                    name="topic"
                                    value={editForm.topic || ""}
                                    onChange={handleEditChange}
                                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5f7f58]"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block mb-1 font-medium">
                                    Subtopic
                                </label>

                                <input
                                    type="text"
                                    name="subtopic"
                                    value={editForm.subtopic || ""}
                                    onChange={handleEditChange}
                                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5f7f58]"
                                />
                            </div>

                            <div>
                                <label className="block mb-1 font-medium">
                                    Difficulty *
                                </label>

                                <select
                                    name="difficulty"
                                    value={editForm.difficulty || ""}
                                    onChange={handleEditChange}
                                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5f7f58]"
                                    required
                                >
                                    <option value="">Select Difficulty</option>
                                    <option value="Easy">Easy</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Hard">Hard</option>
                                </select>
                            </div>

                            <div>
                                <label className="block mb-1 font-medium">
                                    Question Link
                                </label>

                                <input
                                    type="url"
                                    name="link"
                                    value={editForm.link || ""}
                                    onChange={handleEditChange}
                                    placeholder="https://..."
                                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5f7f58]"
                                />
                            </div>

                            <div>
                                <label className="block mb-1 font-medium">
                                    Confidence: {editForm.confidence ?? 3}/5
                                </label>

                                <input
                                    type="range"
                                    name="confidence"
                                    min="1"
                                    max="5"
                                    step="1"
                                    value={editForm.confidence ?? 3}
                                    onChange={handleEditChange}
                                    className="w-full accent-[#5f7f58] mt-2"
                                />

                                <div className="flex justify-between text-sm text-gray-500">
                                    <span>1 - Very weak</span>
                                    <span>5 - Very confident</span>
                                </div>
                            </div>

                            <div>
                                <label className="block mb-1 font-medium">
                                    Date Solved *
                                </label>

                                <input
                                    type="date"
                                    name="dateSolved"
                                    value={editForm.dateSolved || ""}
                                    onChange={handleEditChange}
                                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5f7f58]"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block mb-1 font-medium">
                                    Last Revised
                                </label>

                                <input
                                    type="text"
                                    value={formatDate(editForm.lastRevised)}
                                    readOnly
                                    className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-600"
                                />

                                <p className="text-xs text-gray-500 mt-1">
                                    Updated automatically when you revise the question.
                                </p>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block mb-1 font-medium">
                                    Notes / Mistakes
                                </label>

                                <textarea
                                    name="notes"
                                    value={editForm.notes || ""}
                                    onChange={handleEditChange}
                                    rows="3"
                                    placeholder="Record your approach, mistakes, or concepts to revisit..."
                                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5f7f58]"
                                />
                            </div>

                            <div className="md:col-span-2 flex flex-wrap gap-3 mt-2">
                                <button
                                    type="submit"
                                    className="bg-[#5f7f58] text-white px-5 py-2 rounded-lg hover:bg-[#4d6a47] transition"
                                >
                                    Save Changes
                                </button>

                                <button
                                    type="button"
                                    onClick={closeEditForm}
                                    className="bg-gray-200 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-300 transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Questions;