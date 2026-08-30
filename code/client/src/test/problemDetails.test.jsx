import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProblemDetails from '../pages/ProblemDetails/ProblemDetails';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: {
    getProblem: vi.fn(),
  }
}));

describe('Problem Details & AI Analysis Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 5-component mastery breakdown and 7-part pedagogical AI analysis', async () => {
    const mockProblemData = {
      problem: {
        id: 'prob-42',
        leetcodeId: 42,
        title: 'Trapping Rain Water',
        titleSlug: 'trapping-rain-water',
        difficulty: 'Hard',
        patterns: ['Two Pointers', 'Stack'],
        description: 'Given n non-negative integers representing an elevation map...'
      },
      userState: {
        solved: true,
        mastery: 88,
        masteryBreakdown: {
          solutionEfficiency: 90,
          timeComplexity: 85,
          submissionsUntilSuccess: 100,
          timeTaken: 80,
          hintsUsed: 100
        },
        solvingData: {
          timeTaken: '14 mins',
          submissions: 1,
          runtime: '52ms',
          memory: '18.2MB',
          hintsUsed: 0,
          language: 'Python3'
        },
        fsrs: {
          interval: 7,
          easeFactor: 2.5,
          rating: 4
        },
        acceptedSolution: {
          code: 'class Solution:\n    def trap(self, height: List[int]) -> int:\n        pass',
          analysis: {
            actualTimeComplexity: 'O(N)',
            optimalTimeComplexity: 'O(N)',
            actualSpaceComplexity: 'O(1)',
            optimalSpaceComplexity: 'O(1)',
            richAnalysis: {
              problemUnderstanding: 'Calculate total trapped water between elevation bars.',
              yourApproach: 'Used two pointers moving inward tracking max left and max right.',
              correctness: 'Correctly handles single-bar and decreasing slope edge cases.',
              optimalApproach: 'Optimal two-pointer solution requiring single pass.',
              comparison: 'Approach matches the industry optimal standard.',
              efficiencyAssessment: 'Memory is strictly O(1) without extra arrays.',
              improvementSuggestions: 'Clean and optimal. Ready for spaced repetition.'
            }
          }
        }
      }
    };

    api.getProblem.mockResolvedValueOnce(mockProblemData);

    render(
      <MemoryRouter initialEntries={['/problems/prob-42']}>
        <Routes>
          <Route path="/problems/:id" element={<ProblemDetails />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Trapping Rain Water')).toBeInTheDocument();
    });

    // Check Problem metadata
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('Hard')).toBeInTheDocument();

    // Check 5-component mastery breakdown section
    expect(screen.getByText(/5-Component Mastery Breakdown/i)).toBeInTheDocument();
    expect(screen.getByText(/Solution Efficiency/i)).toBeInTheDocument();
    expect(screen.getByText(/Time Complexity Score/i)).toBeInTheDocument();
    expect(screen.getByText(/Submissions Until Success/i)).toBeInTheDocument();

    // Check Complexity Badges
    expect(screen.getAllByText('O(N)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('O(1)').length).toBeGreaterThan(0);

    // Check 7-part pedagogical AI analysis sections
    expect(screen.getByText(/Problem Requirements & Constraints/i)).toBeInTheDocument();
    expect(screen.getByText(/Calculate total trapped water between elevation bars./i)).toBeInTheDocument();
    expect(screen.getByText(/Used two pointers moving inward tracking max left and max right./i)).toBeInTheDocument();
    expect(screen.getByText(/Correctness & Edge Cases/i)).toBeInTheDocument();
    expect(screen.getByText(/Expected \/ Optimal Approach/i)).toBeInTheDocument();
    expect(screen.getByText(/✨ Key Takeaways & Improvement Suggestions:/i)).toBeInTheDocument();

    // Check Session Performance Metrics
    expect(screen.getByText('14 mins')).toBeInTheDocument();
    expect(screen.getByText('52ms')).toBeInTheDocument();
    expect(screen.getByText('18.2MB')).toBeInTheDocument();

    // Check Code block
    expect(screen.getByText(/def trap\(self, height: List\[int\]\) -> int:/i)).toBeInTheDocument();
  });

  it('renders unsolved call-to-action state when problem has not been solved', async () => {
    const mockUnsolved = {
      problem: {
        id: 'prob-99',
        leetcodeId: 99,
        title: 'Recover BST',
        titleSlug: 'recover-binary-search-tree',
        difficulty: 'Medium',
        patterns: ['Trees']
      },
      userState: null
    };

    api.getProblem.mockResolvedValueOnce(mockUnsolved);

    render(
      <MemoryRouter initialEntries={['/problems/prob-99']}>
        <Routes>
          <Route path="/problems/:id" element={<ProblemDetails />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Recover BST')).toBeInTheDocument();
    });

    expect(screen.getByText(/Ready to Master This Problem\?/i)).toBeInTheDocument();
  });
});
