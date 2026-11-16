import React, { useEffect, useState } from "react";
import api from "../api";

function Analytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await api.get("/dashboard/analytics");
        setAnalytics(response.data);
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to load analytics"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const overview = [
    {
      title: "Total Questions",
      value: analytics?.summary?.totalQuestions ?? 0,
      description: "Questions in your collection",
      color: "bg-blue-50 text-blue-700",
    },
    {
      title: "Total Revisions",
      value: analytics?.summary?.totalRevisions ?? 0,
      description: "Revision sessions completed",
      color: "bg-green-50 text-green-700",
    },
    {
      title: "Average Confidence",
      value: `${analytics?.summary?.averageConfidence ?? 0} / 5`,
      description: "Across all questions",
      color: "bg-orange-50 text-orange-700",
    },
    {
      title: "Topics Covered",
      value: analytics?.topicPerformance?.length ?? 0,
      description: "Unique DSA topics",
      color: "bg-purple-50 text-purple-700",
    },
  ];

  const topicData = analytics?.topicPerformance ?? [];

  const maxQuestions = Math.max(
    1,
    ...topicData.map((topic) => topic.questions)
  );

  const maxRevisions = Math.max(
    1,
    ...topicData.map((topic) => topic.revisions)
  );

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Analytics
        </h1>
        <p className="text-gray-500 mt-4">
          Loading analytics...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Analytics
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
          Analytics
        </h1>
        <p className="text-gray-500 mt-2">
          Track your DSA progress and revision performance.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {overview.map((item, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"
          >
            <p className="text-sm text-gray-500">
              {item.title}
            </p>

            <h2 className="text-3xl font-bold text-gray-800 mt-3">
              {item.value}
            </h2>

            <p className="text-xs text-gray-400 mt-2">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      {/* Topic Performance */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-5">
          Topic Performance
        </h2>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Questions Per Topic */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-700 mb-6">
              Questions by Topic
            </h3>

            <div className="space-y-5">
              {topicData.length === 0 ? (
                <p className="text-gray-400 text-sm">
                  No questions available yet.
                </p>
              ) : (
                topicData.map((topic) => (
                  <div key={topic.topic}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">
                        {topic.topic}
                      </span>

                      <span className="font-medium text-gray-700">
                        {topic.questions}
                      </span>
                    </div>

                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div
                        className="bg-[#315B8C] h-3 rounded-full"
                        style={{
                          width: `${(topic.questions / maxQuestions) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Average Confidence */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-700 mb-6">
              Average Confidence by Topic
            </h3>

            <div className="space-y-5">
              {topicData.length === 0 ? (
                <p className="text-gray-400 text-sm">
                  No confidence data available yet.
                </p>
              ) : (
                topicData.map((topic) => (
                  <div key={topic.topic}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">
                        {topic.topic}
                      </span>

                      <span className="font-medium text-gray-700">
                        {topic.averageConfidence.toFixed(1)} / 5
                      </span>
                    </div>

                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div
                        className="bg-[#F2765E] h-3 rounded-full"
                        style={{
                          width: `${(topic.averageConfidence / 5) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Revision Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          Revision Activity by Topic
        </h2>

        <div className="space-y-5">
          {topicData.length === 0 ? (
            <p className="text-gray-400 text-sm">
              No revision activity available yet.
            </p>
          ) : (
            topicData.map((topic) => (
              <div key={topic.topic}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">
                    {topic.topic}
                  </span>

                  <span className="text-gray-700 font-medium">
                    {topic.revisions} revisions
                  </span>
                </div>

                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full"
                    style={{
                      width: `${(topic.revisions / maxRevisions) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}

export default Analytics;