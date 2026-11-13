import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import StudentReportView from '@/components/dashboard/StudentReportView';
import { activeReport, emptyReport } from '@/test/reportFixture';

const learning = () => within(screen.getByRole('region', { name: /learning progress/i }));
const attention = () => within(screen.getByRole('region', { name: /attention estimate/i }));

describe('a student with no history', () => {
  it('shows an honest empty state instead of sample numbers', () => {
    render(<StudentReportView report={emptyReport()} />);
    expect(screen.getByText('No practice recorded yet')).toBeTruthy();
    expect(learning().getByText('–')).toBeTruthy(); // accuracy is unknown, not 0%
    expect(learning().getAllByText('Not started')).toHaveLength(6);
    expect(learning().getByText(/No badges yet/)).toBeTruthy();
    expect(learning().getByText(/Not enough practice yet/)).toBeTruthy();
    expect(screen.queryByText('Practice over time')).toBeNull(); // no empty charts
  });
});

describe('learning progress', () => {
  it('shows the numbers, trends, weak topics, observations and earned badges from the report', () => {
    render(<StudentReportView report={activeReport()} />);
    const section = learning();
    expect(section.getByText('60%')).toBeTruthy();
    expect(section.getByText('9 of 15 correct')).toBeTruthy();
    expect(section.getByText('Questions answered per day')).toBeTruthy();
    expect(section.getByText('Accuracy on the days practised')).toBeTruthy();
    expect(section.getByText('Topics that need practice')).toBeTruthy();
    expect(section.getByText('Geometry (Area & Perimeter) (mastery 20%)')).toBeTruthy();
    expect(section.getByText('Practised on 2 of the last 7 days.')).toBeTruthy();
    expect(section.getByText('Green Goblin defeated')).toBeTruthy();
    expect(section.getByText(/Not written by AI/)).toBeTruthy();
  });

  it('offers the chart numbers as a table too', () => {
    render(<StudentReportView report={activeReport()} />);
    expect(learning().getByText('Show these numbers as a table')).toBeTruthy();
    expect(learning().getByText('4.5 min')).toBeTruthy();
  });
});

describe('attention estimate', () => {
  it('says the camera was not used, and never reads that as poor attention', () => {
    render(<StudentReportView report={activeReport()} />);
    const section = attention();
    expect(section.getByText(/Camera not used, so there is no estimate/)).toBeTruthy();
    const text = screen.getByRole('region', { name: /attention estimate/i }).textContent ?? '';
    expect(text).not.toMatch(/\b0%/);
    expect(text).not.toMatch(/distracted|inattentive|low attention|poor/i);
  });

  it('shows the estimate with how much was measured, and the caveats', () => {
    const daily = activeReport().daily;
    daily[11] = { ...daily[11], attention_measured: 6, avg_on_screen_pct: 74 };
    render(<StudentReportView report={activeReport({
      daily, attention: { measured_questions: 6, total_questions: 15, avg_on_screen_pct: 74 },
    })} />);
    const section = attention();
    expect(section.getAllByText('74%').length).toBeGreaterThan(0);
    expect(section.getByText('Measured on 6 of 15 questions')).toBeTruthy();
    expect(section.getByText(/other 9 questions were answered with the camera off/)).toBeTruthy();
    expect(section.getByText(/not counted as inattention/)).toBeTruthy();
    expect(section.getByText(/not a medical assessment and not a measure of ability/)).toBeTruthy();
    expect(section.getByText('6 of 10')).toBeTruthy(); // that day's measured share
  });

  it('is kept out of the learning section entirely', () => {
    render(<StudentReportView report={activeReport({
      attention: { measured_questions: 6, total_questions: 15, avg_on_screen_pct: 74 },
    })} />);
    const text = screen.getByRole('region', { name: /learning progress/i }).textContent ?? '';
    expect(text).not.toMatch(/attention|camera|facing the screen|74%/i);
  });
});

describe('wording', () => {
  it('makes no medical or diagnostic claims', () => {
    render(<StudentReportView report={activeReport()} />);
    expect(document.body.textContent).not.toMatch(/ADHD|diagnos|cognitive load|clinical|disorder/i);
  });

  it('explains how the camera and data are handled', () => {
    render(<StudentReportView report={activeReport()} />);
    expect(screen.getByText('How the camera and this data are handled')).toBeTruthy();
    expect(screen.getByText(/No photos or video are saved or sent to MathVerse/)).toBeTruthy();
  });
});
