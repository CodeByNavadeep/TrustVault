
import "../css/DashboardPage.css";

export default function DashboardPage({
  user,
  documents,
  selectedFile,
  onFileChange,
  onUpload,
  onDownload,
  onView,
  onDelete,
  onLogout,
  busy,
  documentError,
}) {
  return (
    <section className="dashboard">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">YOUR WORKSPACE</p>
          <h2>Your documents</h2>
          <p className="muted">Signed in as {user.email}</p>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={onLogout}
          disabled={busy}
        >
          Log out
        </button>
      </div>

      <form className="upload-panel" onSubmit={onUpload}>
        <div>
          <h3>Upload a document</h3>
          <p className="muted">
            Choose a file to store in your private space.
          </p>
        </div>

        <input
          aria-label="Choose a document"
          type="file"
          onChange={(event) =>
            onFileChange(event.target.files?.[0] || null)
          }
        />

        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "Working..." : "Upload file"}
        </button>

        <p className="upload-hint">Maximum upload size: 10 MB.</p>
      </form>

      {documentError && (
        <div className="notice error" role="alert">
          {documentError}
        </div>
      )}

      <div className="document-heading">
        <h3>Stored files</h3>
        <span className="count">{documents.length}</span>
      </div>

      {documents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">↥</div>
          <h3>No documents yet</h3>
          <p className="muted">
            Upload your first file to see it here.
          </p>
        </div>
      ) : (
        <div className="document-list">
          {documents.map((document) => (
            
            <article className="document-row" key={document.id}>
              <div className="file-icon">FILE</div>

              <div className="file-details">
                <strong>{document.filename}</strong>
                <span>
                  {(document.file_size / 1024).toFixed(1)} KB
                  {" · "}
                  {new Date(document.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="document-actions">
                <button
                  className="view-button"
                  type="button"
                  onClick={() => onView(document)}
                >
                  View
                </button>

                <button
                  className="download-button"
                  type="button"
                  onClick={() => onDownload(document)}
                >
                  Download
                </button>

                <button
                  className="delete-button"
                  type="button"
                  onClick={() => onDelete(document)}
                  disabled={busy}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="security-note">
        <span>🔒</span> Only documents belonging to your account are shown.
      </p>
    </section>
  );
}
