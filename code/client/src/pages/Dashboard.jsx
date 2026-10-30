import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";

function badgeFor(score) {
    if (score === null || score === undefined)
        return { cls: "badge-unknown", text: "n/a", dimmed: false, display: "n/a" };
    if (score >= 0.4) return { cls: "badge-high", text: "Important", dimmed: false, display: score.toFixed(2) };
    if (score >= 0.2) return { cls: "badge-mid", text: "Low", dimmed: true, display: score.toFixed(2) };
    return { cls: "badge-low", text: "Archive", dimmed: true, display: score.toFixed(2) };
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [emails, setEmails] = useState([]);
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/api/emails")
            .then((res) => {
                setEmails(res.data.emails);
                setEmail(res.data.email);
                setLoading(false);
            })
            .catch((err) => {
                if (err.response?.status === 401) navigate("/");
                else setLoading(false);
            });
    }, [navigate]);

    return (
        <div className="container">
            <div className="topbar">
                <div>
                    <h2>Prioritized Inbox</h2>
                    <span className="muted">{email}</span>
                </div>
                <div className="nav-links">
                    <Link to="/archived">Archived →</Link>
                </div>
            </div>

            {loading ? (
                <div className="loading">Scoring your inbox…</div>
            ) : emails.length === 0 ? (
                <div className="empty">No emails found.</div>
            ) : (
                emails.map((e) => {
                    const b = badgeFor(e.score);
                    return (
                        <div key={e.id} className={`email ${b.dimmed ? "dimmed" : ""}`}>
                            <div className="email-top">
                                <span className="from">{e.sender}</span>
                                <span className="score-wrap">
                                    <span className={`badge ${b.cls}`}>{b.text}</span>
                                    <span className="score-num">{b.display}</span>
                                </span>
                            </div>
                            <div className="subject">{e.subject || "(no subject)"}</div>
                            <div className="snippet">{e.snippet}</div>
                        </div>
                    );
                })
            )}
        </div>
    );
}