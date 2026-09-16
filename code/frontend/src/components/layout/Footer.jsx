// Global footer displaying safety and medical disclaimer.

export default function Footer() {
  return (
    <footer className="app-footer">
      <p className="disclaimer" data-testid="disclaimer">
        Not a medical device. For general fitness feedback only — not a
        substitute for professional coaching or medical advice.
      </p>
    </footer>
  );
}
