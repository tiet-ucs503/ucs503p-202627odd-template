import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Home from '../pages/Home/Home';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: {
    getDashboard: vi.fn(),
    getRecommendations: vi.fn(),
    submitReview: vi.fn(),
  }
}));

describe('Home / Command Center Dashboard Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders real dashboard KPI values and FSRS recall items', async () => {
    const mockDashboard = {
      stats: {
        totalSolved: 42,
        duePatternsCount: 3,
        patternsCovered: 8,
        totalPatterns: 15,
        averageMastery: 78
      },
      todaysRevision: [
        {
          id: 'prob-1',
          leetcodeId: 1,
          title: 'Two Sum',
          titleSlug: 'two-sum',
          difficulty: 'Easy',
          masteryScore: 92,
          patternsWithMastery: [{ name: 'Hashing', cumulativeMastery: 85, solved: 5, total: 10 }]
        }
      ],
      weakPatterns: [{ pattern: 'Dynamic Programming', totalProblemsSolved: 2, mastery: 35 }],
      strongPatterns: [{ pattern: 'Two Pointers', totalProblemsSolved: 9, mastery: 88 }]
    };

    const mockRecs = {
      recommendations: [
        {
          problem: { leetcodeId: 15, title: '3Sum', titleSlug: '3sum', difficulty: 'Medium' },
          reason: 'Targets your weak Two Pointers pattern'
        }
      ]
    };

    api.getDashboard.mockResolvedValueOnce(mockDashboard);
    api.getRecommendations.mockResolvedValueOnce(mockRecs);

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    // Verify loaded data
    await waitFor(() => {
      expect(screen.getAllByText('Two Sum')[0]).toBeInTheDocument();
    });

    // Check KPI metrics
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('8/15')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();

    // Check Recall section
    expect(screen.getAllByText('Two Sum')[0]).toBeInTheDocument();
    expect(screen.getAllByText('92%')[0]).toBeInTheDocument();
    expect(screen.getByText(/3 Reviews Due Today/i)).toBeInTheDocument();
    expect(screen.getByText('1 Due')).toBeInTheDocument();

    // Check Targeted Practice section
    expect(screen.getByText('3Sum')).toBeInTheDocument();
    expect(screen.getByText(/Targets your weak Two Pointers pattern/i)).toBeInTheDocument();

    // Check Weak and Strong patterns
    expect(screen.getByText('Dynamic Programming')).toBeInTheDocument();
    expect(screen.getByText('Two Pointers')).toBeInTheDocument();
  });

  it('triggers FSRS submitReview API when Mark Done is clicked', async () => {
    const mockDashboard = {
      stats: { totalSolved: 1, duePatternsCount: 1, patternsCovered: 1, totalPatterns: 15, averageMastery: 80 },
      todaysRevision: [
        {
          id: 'p-100',
          leetcodeId: 100,
          title: 'Same Tree',
          titleSlug: 'same-tree',
          difficulty: 'Easy',
          masteryScore: 85,
          patternsWithMastery: [{ name: 'Trees', cumulativeMastery: 85, solved: 1, total: 5 }]
        }
      ],
      weakPatterns: [],
      strongPatterns: []
    };

    api.getDashboard.mockResolvedValueOnce(mockDashboard);
    api.getRecommendations.mockResolvedValueOnce({ recommendations: [] });
    api.submitReview.mockResolvedValueOnce({ success: true });

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Same Tree')[0]).toBeInTheDocument();
    });

    // Find and click "Review Complete"
    const markDoneBtn = screen.getAllByRole('button', { name: /review complete/i })[0];
    fireEvent.click(markDoneBtn);

    // Verify API called with exact problem ID and satisfiedByProblemId
    expect(api.submitReview).toHaveBeenCalledWith('p-100', 'completed', 'p-100');
  });

  it('shows empty state when no recall items are due', async () => {
    const mockDashboard = {
      stats: { totalSolved: 10, duePatternsCount: 0, patternsCovered: 5, totalPatterns: 15, averageMastery: 90 },
      todaysRevision: [],
      weakPatterns: [],
      strongPatterns: []
    };

    api.getDashboard.mockResolvedValueOnce(mockDashboard);
    api.getRecommendations.mockResolvedValueOnce({ recommendations: [] });

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/You're all caught up./i)).toBeInTheDocument();
    });
  });
});
