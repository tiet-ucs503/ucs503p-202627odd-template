import { useState, useEffect } from "react";
import api from "../api";

function History() {
    const [revisionHistory, setRevisionHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const response = await api.get("/revisions/history/all");
                setRevisionHistory(response.data.history || []);
            } catch (error) {
                console.error("Error loading revision history:", error);
                setRevisionHistory([]);
            } finally {
                setLoading(false);
            }
        };

        loadHistory();
    }, []);

    const formatDate = (date) => {
        if (!date) return "—";

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return "—";
        }

        const day = String(parsedDate.getDate()).padStart(2, "0");
        const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
        const year = parsedDate.getFullYear();

        return `${day}-${month}-${year}`;
    };

    if (loading) {
        return (
            <div className="p-6">
                <h1 className="text-2xl font-bold text-slate-800">
                    Revision History
                </h1>

                <p className="mt-4 text-slate-500">
                    Loading revision history...
                </p>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">
                    Revision History
                </h1>

                <p className="mt-1 text-m text-slate-500">
                    Your revisions, newest first.
                </p>
            </div>

            {revisionHistory.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                    <h2 className="text-lg font-semibold text-slate-700">
                        No revisions yet
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        Questions you revise from the Dashboard will appear here.
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-m">
                        <thead className="bg-[#201d1d] text-white">
                            <tr>
                                <th className="px-6 py-4 font-semibold">
                                    Question
                                </th>

                                <th className="px-6 py-4 font-semibold">
                                    Topic
                                </th>

                                <th className="px-6 py-4 font-semibold">
                                    Confidence
                                </th>

                                <th className="px-6 py-4 font-semibold">
                                    Previously Solved
                                </th>

                                <th className="px-6 py-4 font-semibold">
                                    Revision Date
                                </th>

                                <th className="px-6 py-4 font-semibold">
                                    Notes / Mistakes
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {revisionHistory.map((revision) => (
                                <tr
                                    key={revision._id}
                                    className="hover:bg-slate-50"
                                >
                                    <td className="px-6 py-4 font-medium text-slate-800">
                                        {revision.questionId?.title || "—"}
                                    </td>

                                    <td className="px-6 py-4 text-slate-600">
                                        {revision.questionId?.topic || "—"}
                                    </td>

                                    <td className="whitespace-nowrap px-6 py-4">
                                        <span className="text-slate-500">
                                            {revision.previousConfidence}/5
                                        </span>

                                        <span className="mx-2 text-slate-400">
                                            →
                                        </span>

                                        <span className="font-semibold text-slate-800">
                                            {revision.newConfidence}/5
                                        </span>
                                    </td>

                                    <td className="whitespace-nowrap px-6 py-4 text-slate-600">
                                        {revision.questionId?.dateSolved
                                            ? formatDate(
                                                  revision.questionId.dateSolved
                                              )
                                            : "—"}
                                    </td>

                                    <td className="whitespace-nowrap px-6 py-4 text-slate-600">
                                        {formatDate(revision.revisedAt)}
                                    </td>

                                    <td className="px-6 py-4 text-slate-600">
                                        {revision.notes || "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default History;