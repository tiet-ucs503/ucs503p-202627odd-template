import { useState } from "react";

function RevisionModal({ question, onClose, onSave }) {
    const [confidence, setConfidence] = useState(question.confidence ?? 3);
    const [notes, setNotes] = useState(question.notes || "");

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-start mb-5">
                    <div>
                        <h2 className="text-2xl font-semibold">
                            Revise Question
                        </h2>
                        <p className="text-gray-500 mt-1">
                            {question.title}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-800 text-2xl leading-none"
                        aria-label="Close revision form"
                    >
                        &times;
                    </button>
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        onSave(confidence, notes);
                    }}
                >
                    <div className="mb-5">
                        <label className="block mb-2 font-medium">
                            Updated Confidence: {confidence}/5
                        </label>

                        <input
                            type="range"
                            min="1"
                            max="5"
                            step="1"
                            value={confidence}
                            onChange={(e) =>
                                setConfidence(Number(e.target.value))
                            }
                            className="w-full accent-[#5f7f58]"
                        />

                        <div className="flex justify-between text-sm text-gray-500">
                            <span>1 - Very weak</span>
                            <span>5 - Very confident</span>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block mb-2 font-medium">
                            Notes / Mistakes
                        </label>

                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows="3"
                            placeholder="What did you learn or struggle with?"
                            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5f7f58]"
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800"
                        >
                            Save Revision
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default RevisionModal;