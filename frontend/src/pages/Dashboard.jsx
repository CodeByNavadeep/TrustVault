
import {
  Files,
  FilePlus2,
  Users,
  ArrowUpRight,
  UploadCloud,
  Search,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  ShieldCheck,
} from "lucide-react";

function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getFileIcon(filename = "") {
  const extension = filename.split(".").pop()?.toLowerCase();

  if (extension === "pdf") return FileText;
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension)) {
    return ImageIcon;
  }

  return FileIcon;
}

export default function Dashboard({
  user,
  documents = [],
  onNavigate,
  onUploadClick,
  onView,
  onDownload,
  busy,
}) {
  const owned = documents.filter((doc) => doc.permission === "OWNER");
  const shared = documents.filter((doc) => doc.permission !== "OWNER");
  const recent = [...documents]
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime(),
    )
    .slice(0, 5);

  const displayName = user?.name?.trim() || "there";

  return (
    <div className="dashboard-page">
      <section className="welcome-banner">
        <div className="welcome-copy">
          <div className="welcome-eyebrow">
            <ShieldCheck size={15} />
            YOUR SECURE WORKSPACE
          </div>

          <h2>Welcome back, {displayName}.</h2>
          <p>
            Everything important, organized in one secure place.
          </p>

          <button
            className="button button-primary welcome-action"
            onClick={onUploadClick}
            disabled={busy}
          >
            <UploadCloud size={17} />
            Upload a document
          </button>
        </div>

        <div className="welcome-art" aria-hidden="true">
          <div className="welcome-art-circle">
            <ShieldCheck size={72} strokeWidth={1.2} />
          </div>
        </div>
      </section>

      <section className="stats-grid" aria-label="Document summary">
        <article className="stat-card">
          <div className="stat-icon stat-icon-teal">
            <Files size={21} />
          </div>
          <div>
            <p>Total accessible documents</p>
            <strong>{documents.length}</strong>
            <span>Available to your account</span>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-icon stat-icon-blue">
            <FilePlus2 size={21} />
          </div>
          <div>
            <p>My documents</p>
            <strong>{owned.length}</strong>
            <span>Documents you own</span>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-icon stat-icon-violet">
            <Users size={21} />
          </div>
          <div>
            <p>Shared with me</p>
            <strong>{shared.length}</strong>
            <span>Shared access</span>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <h2>Recent documents</h2>
            <p>Your latest accessible files.</p>
          </div>

          <button
            className="button button-secondary"
            onClick={() => onNavigate("documents")}
          >
            View all <ArrowUpRight size={16} />
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Files size={28} />
            </div>
            <h3>Your workspace is ready</h3>
            <p>
              Upload your first document to start building your secure
              document library.
            </p>
            <button
              className="button button-primary"
              onClick={onUploadClick}
              disabled={busy}
            >
              <UploadCloud size={17} />
              Upload your first document
            </button>
          </div>
        ) : (
          <div className="document-list">
            {recent.map((document) => {
              const Icon = getFileIcon(document.filename);

              return (
                <article className="recent-document" key={document.id}>
                  <div className="file-type-icon">
                    <Icon size={21} />
                  </div>

                  <div className="recent-document-info">
                    <strong title={document.filename}>
                      {document.filename}
                    </strong>
                    <span>
                      {document.category || "Uncategorized"} ·{" "}
                      {formatSize(document.file_size)}
                    </span>
                  </div>

                  <div className="recent-document-date">
                    {formatDate(document.created_at)}
                  </div>

                  <div className="recent-document-actions">
                    <button
                      className="icon-button light-icon-button"
                      title="Preview document"
                      aria-label={`Preview ${document.filename}`}
                      onClick={() => onView(document)}
                    >
                      <Search size={17} />
                    </button>
                    <button
                      className="icon-button light-icon-button"
                      title="Download document"
                      aria-label={`Download ${document.filename}`}
                      onClick={() => onDownload(document)}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="dashboard-tip">
        <ShieldCheck size={21} />
        <div>
          <strong>Keep control of your documents</strong>
          <p>
            Share access only with the people who need it. Permissions
            determine who can view, download, or edit shared documents.
          </p>
        </div>
      </section>
    </div>
  );
}
