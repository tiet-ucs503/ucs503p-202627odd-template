const API_URL = import.meta.env.VITE_API_URL;

export async function getPendingWorkers(token) {
  const response = await fetch(`${API_URL}/api/admin/workers`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Failed to fetch workers");
  return data;
}

export async function approveWorker(id, token) {
  const response = await fetch(`${API_URL}/api/admin/workers/${id}/approve`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Failed to approve worker");
  return data;
}

export async function rejectWorker(id, token) {
  const response = await fetch(`${API_URL}/api/admin/workers/${id}/reject`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Failed to reject worker");
  return data;
}

