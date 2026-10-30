import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";

export default function Archived() {
    const navigate = useNavigate();
    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = () => {
        api.get("/api/archived")
            .then((res) => { setEmails(res.data.emails); setLoading(false); })
            .catch((err) => {
                if (err.response?.status === 401) navigate("/");
                else setLoading(false);
            });
    };

    useEffect(load, [navigate]);

    const handleRestore = async (id) => {
        try {
            await api.post(`/api/restore/${id}`);
            // remove it from the list after restoring
            setEmails((prev) => prev.filter((e) => e.id !== id));
        } catch {
            alert("Could not restore. Try again.");
        }
    };

    return (
        <div className="container">
            <div className="topbar">
                <div>
                    <h2>Archived by Vigilante</h2>
                    <span className="muted">Auto-archived low-priority mail</span>
                </div>
                <div className="nav-links">
                    <Link to="/dashboard">← Inbox</Link>
                </div>
            </div>

            {loading ? (
                <div className="loading">Loading…</div>
            ) : emails.length === 0 ? (
                <div className="empty">Nothing archived yet.</div>
            ) : (
                emails.map((e) => (
                    <div key={e.id} className="email">
                        <div className="email-top">
                            <span className="from">{e.sender}</span>
                            <button className="restore-btn" onClick={() => handleRestore(e.id)}>
                                Restore
                            </button>
                        </div>
                        <div className="subject">{e.subject || "(no subject)"}</div>
                        <div className="snippet">{e.snippet}</div>
                    </div>
                ))
            )}
        </div>
    );
}