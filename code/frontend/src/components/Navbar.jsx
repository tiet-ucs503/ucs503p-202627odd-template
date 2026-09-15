import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="navbar">
      <Link to="/" className="nav-logo">
        <span className="nav-logo-icon">S</span>
        ServeConnect
      </Link>

      <nav className="nav-links">
        <Link to="/">Home</Link>
        <Link to="/search">Find Workers</Link>
        {isAuthenticated && user?.role === "admin" && <Link to="/admin">Admin Panel</Link>}
      </nav>

      <div className="nav-links">
        {!isAuthenticated ? (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register" className="btn btn-primary">Get Started</Link>
          </>
        ) : (
          <>
            <span style={{fontWeight: 600}}>Hi, {user?.name || "User"}</span>
            <button onClick={handleLogout} className="btn btn-secondary">Logout</button>
          </>
        )}
      </div>
    </header>
  );
}

export default Navbar;
