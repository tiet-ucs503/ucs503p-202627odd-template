import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import PatternDashboard from '../pages/PatternDashboard/PatternDashboard';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: {
    getPatterns: vi.fn(),
  }
}));

describe('Pattern Mastery Dashboard Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all patterns with tiers, mastery values and problem counts', async () => {
    const mockPatterns = {
      patterns: [
        {
          id: 'pat-1',
          pattern: 'Sliding Window',
          mastery: 85,
          totalProblemsSolved: 6,
          totalProblemsAttempted: 8,
          recallDue: false
        },
        {
          id: 'pat-2',
          pattern: 'Dynamic Programming',
          mastery: 30,
          totalProblemsSolved: 2,
          totalProblemsAttempted: 5,
          recallDue: true
        },
        {
          id: 'pat-3',
          pattern: 'Tries',
          mastery: 0,
          totalProblemsSolved: 0,
          totalProblemsAttempted: 0,
          recallDue: false
        }
      ],
      strongPatterns: [{ pattern: 'Sliding Window', totalProblemsSolved: 6, mastery: 85 }],
      weakPatterns: [{ pattern: 'Dynamic Programming', totalProblemsSolved: 2, mastery: 30 }]
    };

    api.getPatterns.mockResolvedValueOnce(mockPatterns);

    render(
      <BrowserRouter>
        <PatternDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Sliding Window')[0]).toBeInTheDocument();
    });

    expect(screen.getAllByText('Dynamic Programming')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Tries')[0]).toBeInTheDocument();

    // Check strength tiers
    expect(screen.getByText('Mastered')).toBeInTheDocument();
    expect(screen.getByText('Needs Focus')).toBeInTheDocument();
    expect(screen.getByText('Unstarted')).toBeInTheDocument();

    // Check Recall Due badge
    expect(screen.getAllByText(/Recall Due/i).length).toBeGreaterThan(0);
  });

  it('filters patterns using search bar', async () => {
    const mockPatterns = {
      patterns: [
        { id: '1', pattern: 'Binary Search', mastery: 75, totalProblemsSolved: 4, recallDue: false },
        { id: '2', pattern: 'Graphs', mastery: 50, totalProblemsSolved: 3, recallDue: false }
      ],
      strongPatterns: [],
      weakPatterns: []
    };

    api.getPatterns.mockResolvedValueOnce(mockPatterns);

    render(
      <BrowserRouter>
        <PatternDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Binary Search')).toBeInTheDocument();
      expect(screen.getByText('Graphs')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Filter DSA pattern by name/i);
    fireEvent.change(searchInput, { target: { value: 'Binary' } });

    expect(screen.getByText('Binary Search')).toBeInTheDocument();
    expect(screen.queryByText('Graphs')).not.toBeInTheDocument();
  });
});
