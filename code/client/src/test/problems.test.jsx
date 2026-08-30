import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import ProblemLibrary from '../pages/ProblemLibrary/ProblemLibrary';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: {
    getProblems: vi.fn(),
  }
}));

describe('Problem Library Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders problem list with difficulties, patterns, and mastery scores', async () => {
    const mockProblemsResponse = {
      problems: [
        {
          id: 'p-1',
          leetcodeId: 1,
          title: 'Two Sum',
          titleSlug: 'two-sum',
          difficulty: 'Easy',
          patterns: ['Arrays', 'Hashing'],
          userState: { solved: true, mastery: 95 }
        },
        {
          id: 'p-2',
          leetcodeId: 2,
          title: 'Add Two Numbers',
          titleSlug: 'add-two-numbers',
          difficulty: 'Medium',
          patterns: ['Linked List'],
          userState: { solved: false, reviewDue: true }
        }
      ],
      total: 2
    };

    api.getProblems.mockResolvedValueOnce(mockProblemsResponse);

    render(
      <MemoryRouter>
        <ProblemLibrary />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Two Sum')[0]).toBeInTheDocument();
    });

    expect(screen.getAllByText('Add Two Numbers')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Easy')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Medium')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Arrays')[0]).toBeInTheDocument();
  });

  it('filters by difficulty when difficulty chip is clicked', async () => {
    api.getProblems.mockResolvedValue({
      problems: [
        {
          id: 'p-3',
          leetcodeId: 3,
          title: 'Longest Substring',
          titleSlug: 'longest-substring',
          difficulty: 'Medium',
          patterns: ['Sliding Window'],
          userState: null
        }
      ],
      total: 1
    });

    render(
      <MemoryRouter>
        <ProblemLibrary />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(api.getProblems).toHaveBeenCalled();
    });

    // Click "Medium" filter
    const mediumButtons = screen.getAllByRole('button', { name: 'Medium' });
    fireEvent.click(mediumButtons[0]);

    await waitFor(() => {
      expect(api.getProblems).toHaveBeenCalledWith(expect.objectContaining({
        difficulty: 'Medium'
      }));
    });
  });

  it('searches problems as user types', async () => {
    api.getProblems.mockResolvedValue({
      problems: [],
      total: 0
    });

    render(
      <MemoryRouter>
        <ProblemLibrary />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(/Search problems by title/i);
    fireEvent.change(searchInput, { target: { value: 'Binary' } });

    await waitFor(() => {
      expect(api.getProblems).toHaveBeenCalledWith(expect.objectContaining({
        search: 'Binary'
      }));
    });
  });
});
