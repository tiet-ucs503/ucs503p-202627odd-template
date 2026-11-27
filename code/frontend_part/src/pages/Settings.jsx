import { useState } from "react";

function Settings() {
    const [dailyTarget, setDailyTarget] = useState(() => {
        return Number(localStorage.getItem("algoRecallDailyTarget")) || 3;
    });

    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        localStorage.setItem(
            "algoRecallDailyTarget",
            String(dailyTarget)
        );

        setSaved(true);
    };

    return (
        <div className="p-6 bg-gray-100 min-h-screen">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">
                    Settings
                </h1>

                <p className="mt-1 text-sm text-gray-500">
                    Customize your daily revision preferences.
                </p>
            </div>

            <div className="max-w-2xl bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-800">
                    Daily Revision Target
                </h2>

                <p className="mt-2 text-sm text-gray-500">
                    Choose how many questions you want to revise each day.
                </p>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 mt-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((number) => (
                        <button
                            key={number}
                            type="button"
                            onClick={() => {
                                setDailyTarget(number);
                                setSaved(false);
                            }}
                            className={`py-3 rounded-lg border font-semibold transition ${
                                dailyTarget === number
                                    ? "bg-[#5f7f58] text-white border-[#5f7f58]"
                                    : "bg-white text-gray-700 border-gray-300 hover:bg-[#5f7f58]/10 hover:border-[#5f7f58]"
                            }`}
                        >
                            {number}
                        </button>
                    ))}
                </div>

                <p className="mt-4 text-sm text-gray-600">
                    Daily target: <strong>{dailyTarget} questions</strong>
                </p>

                <div className="flex items-center gap-4 mt-6">
                    <button
                        type="button"
                        onClick={handleSave}
                        className="bg-[#5f7f58] text-white px-5 py-2 rounded-lg hover:bg-[#4d6a47] transition"
                    >
                        Save Settings
                    </button>

                    {saved && (
                        <p className="text-sm text-green-600 font-medium">
                            Settings saved successfully!
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Settings;