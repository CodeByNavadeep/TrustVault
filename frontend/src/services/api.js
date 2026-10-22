const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
  });

  const contentType = response.headers.get("content-type") || "";
  let data = null;

  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const error = new Error(
      data?.error || data?.message || `Request failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

async function fileRequest(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await response.json();
        message = data?.error || data?.message || message;
      }
    } catch {
      // Keep the fallback error message.
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response;
}

export const api = {
  health: () => request("/health"),

  register: (name, email, password) =>
    request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),

  me: () => request("/auth/me"),

  logout: () => request("/auth/logout", { method: "POST" }),

  getDocuments: (filters = {}) => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    });

    const query = params.toString();
    return request(`/documents${query ? `?${query}` : ""}`);
  },

  uploadDocument: (file, category = "Uncategorized") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);

    return request("/documents", {
      method: "POST",
      body: formData,
    });
  },

  downloadDocument: (id) => fileRequest(`/documents/${id}/download`),

  viewDocument: (id) => fileRequest(`/documents/${id}/view`),

  renameDocument: (id, filename) =>
    request(`/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
    }),

  deleteDocument: (id) =>
    request(`/documents/${id}`, {
      method: "DELETE",
    }),

  // Share management
  getDocumentShares: (id) => request(`/documents/${id}/shares`),

  shareDocument: (id, email, permission = "READ") =>
    request(`/documents/${id}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        recipient_email: email.trim(),
        permission,
      }),
    }),

  revokeDocumentShare: (id, recipientId) =>
    request(`/documents/${id}/shares/${recipientId}`, {
      method: "DELETE",
    }),

  // My Activity
  getMyActivity: () => request("/activity?limit=50"),

  // Admin Audit Logs

  getAdminAuditLogs: (filters = {}) => {
    const params = new URLSearchParams();

    if (filters.event_type) {
      params.set("event_type", filters.event_type);
    }

    if (filters.actor_name) {
      params.set("actor_name", filters.actor_name);
    }

    if (filters.document_name) {
      params.set("document_name", filters.document_name);
    }

    params.set("limit", String(filters.limit || 50));

    return request(`/admin/audit-logs?${params.toString()}`);
  },
};
