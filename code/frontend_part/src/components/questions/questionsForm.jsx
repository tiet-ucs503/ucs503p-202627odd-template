import { useState } from "react";
import api from "../../api";

function QuestionsForm() {
    const [formData, setFormData] = useState({
        title: "",
        topic: "",
        subtopic: "",
        difficulty: "",
        platform: "LeetCode",
        link: "",
        confidence: "3",
        dateSolved: new Date().toLocaleDateString("en-CA"),
        notes: "",
    });

    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState("");

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            await api.post("/questions", {
                title: formData.title,
                topic: formData.topic,
                subtopic: formData.subtopic,
                difficulty: formData.difficulty,
                platform: formData.platform,
                link: formData.link,
                confidence: Number(formData.confidence),
                dateSolved: formData.dateSolved,
                notes: formData.notes,
            });

            setFormData({
                title: "",
                topic: "",
                subtopic: "",
                difficulty: "",
                platform: "LeetCode",
                link: "",
                confidence: "3",
                dateSolved: new Date().toLocaleDateString("en-CA"),
                notes: "",
            });

            setMessage("Question added successfully!");
            setMessageType("success");
        } catch (error) {
            console.error("Error saving question:", error);
            setMessage("Unable to save question. Please try again.");
            setMessageType("error");
        }
    };

    return (
        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-md p-8">
            <h2 className="text-2xl font-semibold mb-6 md:col-span-2">
                Add New Question
            </h2>

            {message && (
                <div
                    role="status"
                    className={`mb-4 p-3 rounded-lg md:col-span-2 ${
                        messageType === "success"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                    }`}
                >
                    {message}
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
                <div>
                    <label className="block mb-1 font-medium">
                        Question Title *
                    </label>
                    <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        placeholder="e.g. Two Sum"
                        className="w-full border rounded-lg px-3 py-2"
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
                        value={formData.topic}
                        onChange={handleChange}
                        placeholder="e.g. Arrays"
                        className="w-full border rounded-lg px-3 py-2"
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
                        value={formData.subtopic}
                        onChange={handleChange}
                        placeholder="e.g. Hashing"
                        className="w-full border rounded-lg px-3 py-2"
                    />
                </div>

                <div>
                    <label className="block mb-1 font-medium">
                        Difficulty *
                    </label>
                    <select
                        name="difficulty"
                        value={formData.difficulty}
                        onChange={handleChange}
                        className="w-full border rounded-lg px-3 py-2"
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
                        Platform *
                    </label>
                    <select
                        name="platform"
                        value={formData.platform}
                        onChange={handleChange}
                        className="w-full border rounded-lg px-3 py-2"
                        required
                    >
                        <option value="LeetCode">LeetCode</option>
                        <option value="GeeksforGeeks">GeeksforGeeks</option>
                        <option value="CodeStudio">CodeStudio</option>
                        <option value="Other">Other</option>
                    </select>
                </div>

                <div>
                    <label className="block mb-1 font-medium">
                        Question Link
                    </label>
                    <input
                        type="url"
                        name="link"
                        value={formData.link}
                        onChange={handleChange}
                        placeholder="https://..."
                        className="w-full border rounded-lg px-3 py-2"
                    />
                </div>

                <div>
                    <label className="block mb-1 font-medium">
                        Initial Confidence: {formData.confidence}/5
                    </label>
                    <input
                        type="range"
                        name="confidence"
                        min="1"
                        max="5"
                        step="1"
                        value={formData.confidence}
                        onChange={handleChange}
                        className="w-full accent-[#5f7f58]"
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
                        value={formData.dateSolved}
                        onChange={handleChange}
                        className="w-full border rounded-lg px-3 py-2"
                        required
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="block mb-1 font-medium">
                        Notes / Mistakes
                    </label>
                    <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        placeholder="Record your approach, mistakes, or concepts to revisit..."
                        rows="2"
                        className="w-full border rounded-lg px-3 py-2"
                    />
                </div>

                <button
                    type="submit"
                    className="bg-[#5f7f58] text-white px-4 py-2 rounded-lg hover:bg-[#4d6a47]"
                >
                    Add Question
                </button>
            </form>
        </div>
    );
}

export default QuestionsForm;