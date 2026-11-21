import { useState } from "react";
import Papa from "papaparse";

const CSV_HEADERS = [
    "title",
    "topic",
    "subtopic",
    "difficulty",
    "platform",
    "link",
    "confidence",
    "dateSolved",
    "notes",
];

const today = () => {
    const date = new Date();
    const localDate = new Date(
        date.getTime() - date.getTimezoneOffset() * 60000
    );

    return localDate.toISOString().slice(0, 10);
};

function QuestionsCSVImport() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewQuestions, setPreviewQuestions] = useState([]);
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState("");
    const [isValid, setIsValid] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const showError = (text) => {
        setMessage(text);
        setMessageType("error");
        setIsValid(false);
        setPreviewQuestions([]);
    };

    const handleDownloadTemplate = () => {
        const sampleRow = [
            "Two Sum",
            "Arrays",
            "Hashing",
            "Easy",
            "LeetCode",
            "https://leetcode.com/problems/two-sum/",
            "3",
            today(),
            "Practise the hash map approach",
        ];

        const csvContent =
            CSV_HEADERS.join(",") +
            "\r\n" +
            sampleRow
                .map((value) => `"${value.replace(/"/g, '""')}"`)
                .join(",") +
            "\r\n";

        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "algo-recall-template.csv";

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];

        setSelectedFile(null);
        setPreviewQuestions([]);
        setIsValid(false);
        setMessage("");
        setMessageType("");

        if (!file) return;

        if (!file.name.toLowerCase().endsWith(".csv")) {
            showError("Please select a CSV file.");
            e.target.value = "";
            return;
        }

        setSelectedFile(file);
    };

    const handleValidate = () => {
        if (!selectedFile) {
            showError("Please select a CSV file first.");
            return;
        }

        setIsProcessing(true);
        setMessage("");
        setPreviewQuestions([]);
        setIsValid(false);

        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: "greedy",
            transformHeader: (header) => header.trim(),

            complete: (results) => {
                try {
                    if (results.errors.length > 0) {
                        const firstError = results.errors[0];

                        showError(
                            `CSV parsing error near row ${
                                (firstError.row ?? 0) + 2
                            }: ${firstError.message}`
                        );

                        return;
                    }

                    const headers = results.meta.fields || [];
                    const headersMatch =
                        headers.length === CSV_HEADERS.length &&
                        CSV_HEADERS.every(
                            (header, index) => headers[index] === header
                        );

                    if (!headersMatch) {
                        showError(
                            `Invalid CSV headers. Use the downloaded template with these exact columns, in order: ${CSV_HEADERS.join(", ")}.`
                        );

                        return;
                    }

                    if (results.data.length === 0) {
                        showError("The CSV file contains no questions.");
                        return;
                    }

                    const questions = [];
                    const errors = [];

                    results.data.forEach((row, index) => {
                        const rowNumber = index + 2;
                        const question = {};

                        CSV_HEADERS.forEach((header) => {
                            question[header] =
                                typeof row[header] === "string"
                                    ? row[header].trim()
                                    : "";
                        });

                        if (!question.title) {
                            errors.push(
                                `Row ${rowNumber}: Title is required.`
                            );
                        }

                        if (!question.topic) {
                            errors.push(
                                `Row ${rowNumber}: Topic is required.`
                            );
                        }

                        if (
                            !["Easy", "Medium", "Hard"].includes(
                                question.difficulty
                            )
                        ) {
                            errors.push(
                                `Row ${rowNumber}: Difficulty must be Easy, Medium, or Hard.`
                            );
                        }

                        if (
                            question.confidence !== "" &&
                            !/^[1-5]$/.test(question.confidence)
                        ) {
                            errors.push(
                                `Row ${rowNumber}: Confidence must be a whole number from 1 to 5.`
                            );
                        }

                        if (
                            question.link &&
                            !/^https?:\/\/\S+$/i.test(question.link)
                        ) {
                            errors.push(
                                `Row ${rowNumber}: Link must be a valid HTTP or HTTPS URL.`
                            );
                        }

                        if (question.dateSolved) {
                            const date = new Date(
                                `${question.dateSolved}T00:00:00Z`
                            );

                            const isValidDate =
                                /^\d{4}-\d{2}-\d{2}$/.test(
                                    question.dateSolved
                                ) &&
                                !Number.isNaN(date.getTime()) &&
                                date.toISOString().slice(0, 10) ===
                                    question.dateSolved;

                            if (!isValidDate) {
                                errors.push(
                                    `Row ${rowNumber}: Date solved must be a valid date in YYYY-MM-DD format.`
                                );
                            }
                        }

                        if (!question.platform) {
                            question.platform = "LeetCode";
                        }

                        if (!question.confidence) {
                            question.confidence = "3";
                        }

                        if (!question.dateSolved) {
                            question.dateSolved = today();
                        }

                        questions.push(question);
                    });

                    if (errors.length > 0) {
                        showError(
                            `CSV rejected. No questions were imported.\n${errors.join("\n")}`
                        );

                        return;
                    }

                    setPreviewQuestions(questions);
                    setIsValid(true);
                    setMessage(
                        `${questions.length} questions validated successfully. Review the preview before importing.`
                    );
                    setMessageType("success");
                } catch (error) {
                    console.error("CSV validation error:", error);
                    showError("Unable to validate this CSV file.");
                } finally {
                    setIsProcessing(false);
                }
            },

            error: (error) => {
                showError(`Unable to read CSV: ${error.message}`);
                setIsProcessing(false);
            },
        });
    };

    const handleImport = () => {
        if (!isValid || previewQuestions.length === 0) return;

        try {
            const savedQuestions = JSON.parse(
                localStorage.getItem("algoRecallQuestions") || "[]"
            );

            if (!Array.isArray(savedQuestions)) {
                showError(
                    "Saved question data is invalid. Nothing was imported."
                );
                return;
            }

            const importedQuestions = previewQuestions.map((question) => ({
                ...question,
                id: crypto.randomUUID(),
                confidence: Number(question.confidence),
                createdAt: new Date().toISOString(),
            }));

            localStorage.setItem(
                "algoRecallQuestions",
                JSON.stringify([...savedQuestions, ...importedQuestions])
            );

            setSelectedFile(null);
            setPreviewQuestions([]);
            setIsValid(false);
            setMessage(
                `Successfully imported ${importedQuestions.length} questions!`
            );
            setMessageType("success");
        } catch (error) {
            console.error("CSV import error:", error);
            showError("Unable to import questions. Please try again.");
        }
    };

    return (
        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-md p-8">
            <h2 className="text-2xl font-semibold mb-2">
                Bulk Import Questions
            </h2>

            <p className="text-gray-600 mb-6">
                Import multiple DSA questions using a CSV file.
            </p>

            {message && (
                <div
                    role="status"
                    aria-live="polite"
                    className={`mb-4 p-3 rounded-lg ${
                        messageType === "success"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                    }`}
                    style={{ whiteSpace: "pre-line" }}
                >
                    {message}
                </div>
            )}

            <div className="border border-dashed border-gray-300 rounded-lg p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h3 className="font-medium text-gray-800">
                            Step 1: Download the CSV template
                        </h3>

                        <p className="text-sm text-gray-500 mt-1">
                            Keep the exact column headers and their order.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="bg-[#5f7f58] text-white px-4 py-2 rounded-lg hover:bg-[#4d6a47] transition"
                    >
                        Download CSV Template
                    </button>
                </div>

                <div className="border-t my-6" />

                <div>
                    <h3 className="font-medium text-gray-800 mb-2">
                        Step 2: Select your CSV file
                    </h3>

                    <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-600
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-lg file:border-0
                            file:bg-[#5f7f58]/10 file:text-[#5f7f58]
                            hover:file:bg-[#5f7f58]/20"
                    />

                    {selectedFile && (
                        <p className="text-sm text-gray-600 mt-3">
                            Selected file:{" "}
                            <span className="font-medium">
                                {selectedFile.name}
                            </span>
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={handleValidate}
                        disabled={!selectedFile || isProcessing}
                        className="mt-4 bg-[#5f7f58] text-white px-5 py-2 rounded-lg hover:bg-[#4d6a47] disabled:opacity-50 transition"
                    >
                        {isProcessing ? "Validating..." : "Validate CSV"}
                    </button>
                </div>
            </div>

            {isValid && previewQuestions.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3">
                        Preview ({previewQuestions.length} questions)
                    </h3>

                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    {CSV_HEADERS.map((header) => (
                                        <th
                                            key={header}
                                            className="px-3 py-2 text-left whitespace-nowrap"
                                        >
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody>
                                {previewQuestions.map((question, index) => (
                                    <tr key={index} className="border-t">
                                        {CSV_HEADERS.map((header) => (
                                            <td
                                                key={header}
                                                className="px-3 py-2 whitespace-nowrap"
                                            >
                                                {question[header]}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <button
                        type="button"
                        onClick={handleImport}
                        className="mt-4 bg-[#5f7f58] text-white px-5 py-2 rounded-lg hover:bg-[#4d6a47] transition"
                    >
                        Import {previewQuestions.length} Questions
                    </button>
                </div>
            )}
        </div>
    );
}

export default QuestionsCSVImport;