
import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString();
}

function formatFileSize(bytes) {
  if (bytes == null || Number.isNaN(Number(bytes))) return "—";

  const size = Number(bytes);

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileType(filename = "") {
  const extension = filename.split(".").pop()?.toLowerCase();

  if (extension === "pdf") return "PDF";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension)) {
    return "IMG";
  }
  if (["doc", "docx"].includes(extension)) return "DOC";
  if (["xls", "xlsx", "csv"].includes(extension)) return "XLS";

  return "FILE";
}

export default function SharedPage({ onView, onDownload }) {
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSharedDocuments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.getDocuments();
      const allDocuments = response?.documents ?? [];

      setDocuments(
        allDocuments.filter(
          (document) => document.permission !== "OWNER"
        )
      );
    } catch (err) {
      setError(err.message || "Unable to load shared documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSharedDocuments();
  }, [loadSharedDocuments]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredDocuments = documents.filter((document) => {
    const searchableText = [
      document.filename,
      document.owner_email,
      document.category,
      document.permission,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedSearch);
  });

  return (
    <div className="dashboard-page documents-page shared-page">
      <div className="section-heading shared-page-header">
        <div>
          <h2>Shared with me</h2>
          <p>Documents other users have shared with your account.</p>
        </div>

        <button
          type="button"
          className="button button-secondary"
          onClick={loadSharedDocuments}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <section className="dashboard-section shared-page-panel">
        <div className="document-library-toolbar shared-page-toolbar">
          <input
            className="shared-page-search"
            type="search"
            placeholder="Search documents, owners or permissions..."
            aria-label="Search shared documents"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <span className="shared-page-count">
            {filteredDocuments.length}{" "}
            {filteredDocuments.length === 1 ? "document" : "documents"}
          </span>
        </div>

        {error && (
          <div className="shared-page-error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="button button-secondary"
              onClick={loadSharedDocuments}
            >
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div className="shared-page-empty" role="status">
            Loading shared documents...
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="shared-page-empty">
            {documents.length === 0
              ? "No documents have been shared with you yet."
              : "No documents match your search."}
          </div>
        ) : (
          <div className="document-list shared-document-list">
            {filteredDocuments.map((document) => (
              <article className="recent-document" key={document.id}>
                <div className="file-type-icon" aria-hidden="true">
                  {getFileType(document.filename)}
                </div>

                <div className="recent-document-info shared-document-info">
                  <strong title={document.filename}>
                    {document.filename}
                  </strong>

                  <span>
                    Shared by: {document.owner_email || "Unknown owner"}
                  </span>

                  <span>
                    {document.category || "Uncategorized"} ·{" "}
                    {formatFileSize(document.file_size)} ·{" "}
                    {formatDate(document.created_at)}
                  </span>

                  <span>
                    Permission:{" "}
                    <span
                      className={`shared-permission ${
                        document.permission === "EDIT"
                          ? "shared-permission-edit"
                          : "shared-permission-read"
                      }`}
                    >
                      {document.permission || "READ"}
                    </span>
                  </span>
                </div>

                <div className="recent-document-actions shared-document-actions">
                  <button
                    type="button"
                    className="button button-secondary shared-action-button"
                    onClick={() => onView(document)}
                    aria-label={`View ${document.filename}`}
                    title="Preview document"
                  >
                    View
                  </button>

                  <button
                    type="button"
                    className="button button-secondary shared-action-button"
                    onClick={() => onDownload(document)}
                    aria-label={`Download ${document.filename}`}
                    title="Download document"
                  >
                    Download
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
