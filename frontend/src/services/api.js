
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
  
async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const error = new Error(
      data?.error || data?.message || `Request failed (${response.status})`
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

export const api = {
  health: () => request("/health"),

  register: (email, password) =>
    request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),

  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),

  me: () => request("/auth/me"),

  logout: () => request("/auth/logout", { method: "POST" }),

  getDocuments: () => request("/documents"),

  uploadDocument: (file) => {
    const formData = new FormData();
    formData.append("file", file);

    return request("/documents", {
      method: "POST",
      body: formData,
    });
  },

  downloadDocument: (id) =>
    fetch(`${API_BASE}/documents/${id}/download`, {
      credentials: "include",
    }),

    viewDocument: (id) =>
  fetch(`${API_BASE}/documents/${id}/view`, {
    credentials: "include",
  }),

    deleteDocument: (id) =>
    request(`/documents/${id}`, {
        method: "DELETE",
    }),
};

