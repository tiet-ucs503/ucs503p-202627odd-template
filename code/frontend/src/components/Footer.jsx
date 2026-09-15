import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="footer">
      <div>
        <strong>ServeConnect</strong>
        <p style={{ marginTop: '0.25rem' }}>Connecting customers with trusted local professionals.</p>
      </div>

      <div className="footer-links">
        <Link to="/search">Find Workers</Link>
        <Link to="/worker/register">Join as Worker</Link>
        <Link to="/login">Login</Link>
        <span>© 2026 ServeConnect</span>
      </div>
    </footer>
  );
}

export default Footer;