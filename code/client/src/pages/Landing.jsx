import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function Landing() {
    const navigate = useNavigate();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        // if already connected, skip straight to the dashboard
        api.get("/api/status").then((res) => {
            if (res.data.connected) navigate("/dashboard");
            else setChecking(false);
        }).catch(() => setChecking(false));
    }, [navigate]);

    const handleConnect = () => {
        // send the user to the backend OAuth flow
        window.location.href = "/auth/google";
    };

    if (checking) return <div className="loading">Loading…</div>;

    return (
        <div className="landing">
            <h1>VIGILANTE</h1>
            <p className="tagline">Your inbox, prioritized.</p>
            <p className="desc">
                Vigilante connects to your Gmail and learns what matters — surfacing
                important mail and quietly archiving the noise, automatically.
            </p>
            <button className="btn" onClick={handleConnect}>Connect Gmail</button>
        </div>
    );
}