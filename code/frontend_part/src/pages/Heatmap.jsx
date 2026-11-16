import React, { useEffect, useState } from "react";
import api from "../api";

function Heatmap() {
  const [heatmap, setHeatmap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        const response = await api.get("/dashboard/heatmap");
        setHeatmap(response.data.heatmap ?? {});
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to load revision heatmap"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchHeatmap();
  }, []);

  const getDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const getColor = (count) => {
    if (count === 0) return "bg-gray-100";
    if (count === 1) return "bg-green-200";
    if (count <= 3) return "bg-green-400";
    if (count <= 5) return "bg-green-600";
    return "bg-green-800";
  };

  const today = new Date();
  const startDate = new Date(today);

  startDate.setDate(today.getDate() - 364);

  // Align the beginning to Sunday.
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const dates = [];

  for (
    let date = new Date(startDate);
    date <= today;
    date.setDate(date.getDate() + 1)
  ) {
    dates.push(new Date(date));
  }

  const weeks = [];

  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7));
  }

  const totalRevisions = Object.values(heatmap).reduce(
    (total, count) => total + count,
    0
  );

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Revision Heatmap
        </h1>

        <p className="text-gray-500 mt-4">
          Loading heatmap...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Revision Heatmap
        </h1>

        <p className="text-red-500 mt-4">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">

      {/* Page Heading */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">
          Revision Heatmap
        </h1>

        <p className="text-gray-500 mt-2">
          Visualize your revision consistency over the past year.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <p className="text-sm text-gray-500">
          Total Revisions
        </p>

        <h2 className="text-3xl font-bold text-gray-800 mt-2">
          {totalRevisions}
        </h2>

        <p className="text-sm text-gray-400 mt-1">
          Recorded revision sessions
        </p>
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">

        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          Revision Activity
        </h2>

        <div className="overflow-x-auto">
          <div className="min-w-max">

            {/* Weekday Labels */}
            <div className="flex mb-2">
              <div className="grid grid-rows-7 gap-1 mr-3 text-xs text-gray-400">
                <span></span>
                <span>Mon</span>
                <span></span>
                <span>Wed</span>
                <span></span>
                <span>Fri</span>
                <span></span>
              </div>

              {/* Heatmap Grid */}
              <div className="flex gap-1">
                {weeks.map((week, weekIndex) => (
                  <div
                    key={weekIndex}
                    className="grid grid-rows-7 gap-1"
                  >
                    {week.map((date) => {
                      const dateKey = getDateKey(date);
                      const count = heatmap[dateKey] ?? 0;

                      return (
                        <div
                          key={dateKey}
                          title={`${dateKey}: ${count} revision${
                            count !== 1 ? "s" : ""
                          }`}
                          className={`w-3 h-3 rounded-sm ${getColor(
                            count
                          )}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-5 text-xs text-gray-500">
              <span>Less</span>

              <div className="w-3 h-3 rounded-sm bg-gray-100" />
              <div className="w-3 h-3 rounded-sm bg-green-200" />
              <div className="w-3 h-3 rounded-sm bg-green-400" />
              <div className="w-3 h-3 rounded-sm bg-green-600" />
              <div className="w-3 h-3 rounded-sm bg-green-800" />

              <span>More</span>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}

export default Heatmap;