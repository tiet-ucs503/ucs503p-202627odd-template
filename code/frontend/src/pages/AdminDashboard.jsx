import { useState, useEffect } from "react";
import { getPendingWorkers, approveWorker, rejectWorker } from "../services/adminService";
import { useAuth } from "../context/AuthContext";

function AdminDashboard() {
  const [workers, setWorkers] = useState([]);
  const { token } = useAuth();

  const fetchWorkers = async () => {
    try {
      const data = await getPendingWorkers(token);
      setWorkers(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  async function handleApprove(id) {
    try {
      await approveWorker(id, token);
      fetchWorkers();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleReject(id) {
    try {
      await rejectWorker(id, token);
      fetchWorkers();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="page admin-page">
      <div className="admin-header">
        <div>
          <span className="section-label">ADMIN PANEL</span>
          <h1>Worker Applications</h1>
          <p>Review and manage service worker registration requests.</p>
        </div>
      </div>

      <div className="admin-stats">
        <div className="admin-stat-card">
          <span>Total Applications</span>
          <strong>{workers.length}</strong>
        </div>

        <div className="admin-stat-card">
          <span>Pending</span>
          <strong>{workers.filter((w) => w.status === "pending").length}</strong>
        </div>

        <div className="admin-stat-card">
          <span>Approved</span>
          <strong>{workers.filter((w) => w.status === "approved").length}</strong>
        </div>

        <div className="admin-stat-card">
          <span>Rejected</span>
          <strong>{workers.filter((w) => w.status === "rejected").length}</strong>
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-section-header">
          <div>
            <h2>Worker applications</h2>
            <p>Review applications submitted by service workers.</p>
          </div>
        </div>

        <div className="worker-table-wrapper">
          <table className="worker-table">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Category</th>
                <th>Experience</th>
                <th>Charges</th>
                <th>Location</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {workers.map((worker) => (
                <tr key={worker._id}>
                  <td><strong>{worker.userId?.name || "Unknown"}</strong></td>
                  <td>{worker.category}</td>
                  <td>{worker.experience} years</td>
                  <td>₹{worker.charges}/hr</td>
                  <td>{worker.location}</td>
                  <td>
                    <span className={`status-badge ${worker.status}`}>
                      {worker.status}
                    </span>
                  </td>
                  <td>
                    {worker.status === "pending" ? (
                      <div className="admin-actions">
                        <button className="approve-btn" onClick={() => handleApprove(worker._id)}>Approve</button>
                        <button className="reject-btn" onClick={() => handleReject(worker._id)}>Reject</button>
                      </div>
                    ) : (
                      <span className="action-completed">Reviewed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {workers.length === 0 && <p className="empty-state">No workers found.</p>}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
