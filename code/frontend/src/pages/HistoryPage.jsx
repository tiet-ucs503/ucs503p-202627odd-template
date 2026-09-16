// Modular page wrapper for athlete training logbook and detailed analytics.
import HistoryView from "@/components/HistoryView.jsx";

export default function HistoryPage({ onNavigate }) {
  return (
    <div className="page-view history-page" data-testid="history-page">
      <HistoryView onNavigate={onNavigate} />
    </div>
  );
}
