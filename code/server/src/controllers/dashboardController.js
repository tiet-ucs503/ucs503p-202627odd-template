import {
  getDashboardData,
  getDashboardStats,
} from "../services/dashboard/dashboardService.js";

/**
 * GET /api/dashboard
 * Get dashboard with stats and today's revision
 */
export const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const dashboardData = await getDashboardData(userId);

    res.status(200).json({
      stats: dashboardData.stats,
      todaysRevision: dashboardData.todaysRevision,
      weakPatterns: dashboardData.weakPatterns,
      strongPatterns: dashboardData.strongPatterns,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/dashboard/stats
 * Get dashboard stats only (faster, lightweight)
 */
export const getDashboardStatsOnly = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const stats = await getDashboardStats(userId);

    res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
};
