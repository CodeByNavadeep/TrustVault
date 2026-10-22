
import { useCallback, useEffect, useRef, useState } from "react";
import { Files, ShieldCheck, UploadCloud, X } from "lucide-react";

import "./styles/global.css";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Notice from "./components/Notice";
import { api } from "./services/api";
import DocumentsPage from "./pages/DocumentsPage";
import SharedPage from "./pages/SharedPage";
import ActivityPage from "./pages/ActivityPage";
import AdminAuditLogsPage from "./pages/AdminAuditLogsPage";

const CATEGORIES = [
  "Uncategorized",
  "Contracts",
  "Reports",
  "Finance",
  "Personal",
  "Work",
  "Other",
];

function App() {
  const [apiStatus, setApiStatus] = useState("Checking...");
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [documentError, setDocumentError] = useState("");
  const [page, setPage] = useState("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadCategory, setUploadCategory] = useState("Uncategorized");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);

  const loadDocuments = useCallback(async () => {
    setDocumentError("");

    try {
      const data = await api.getDocuments();
      setDocuments(data.documents || []);
      return true;
    } catch (err) {
      setDocumentError(`Couldn't load documents: ${err.message}`);
      return false;
    }
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      const currentUser = await api.me();
      setUser(currentUser.user);
      setPage("dashboard");
      await loadDocuments();
    } catch (err) {
      if (err.status === 401) {
        setUser(null);
        setDocuments([]);
        setPage("login");
      } else {
        setError(`Couldn't verify your session: ${err.message}`);
      }
    }
  }, [loadDocuments]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const health = await api.health();

        if (!cancelled) {
          setApiStatus(
            health.status === "ok" ? "Connected" : "Unavailable"
          );
        }
      } catch {
        if (!cancelled) setApiStatus("Disconnected");
      }

      if (!cancelled) {
        await restoreSession();
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [restoreSession]);

  function changePage(nextPage) {
    setPage(nextPage);
    setError("");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleAuth(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (page === "register") {
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }

        await api.register(name.trim(), email, password);

        setPage("login");
        setPassword("");
        setConfirmPassword("");
        setMessage("Account created. You can now log in.");
        return;
      }

      await api.login(email, password);
      const currentUser = await api.me();

      setUser(currentUser.user);
      setPage("dashboard");
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setMessage("Welcome to TrustVault.");

      await loadDocuments();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function openFilePicker() {
    if (busy) return;

    setUploadError("");
    setError("");
    setMessage("");
    fileInputRef.current?.click();
  }

  function handleFileSelection(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadCategory("Uncategorized");
    setUploadError("");
    setShowUploadDialog(true);
  }

  function closeUploadDialog() {
    if (busy) return;

    setShowUploadDialog(false);
    setSelectedFile(null);
    setUploadCategory("Uncategorized");
    setUploadError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleUpload() {
    if (!selectedFile || busy) return;

    setBusy(true);
    setUploadError("");
    setError("");
    setMessage("");

    try {
      await api.uploadDocument(selectedFile, uploadCategory);

      setShowUploadDialog(false);
      setSelectedFile(null);
      setUploadCategory("Uncategorized");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      const refreshed = await loadDocuments();

      setMessage(
        refreshed
          ? "Document uploaded successfully."
          : "Document uploaded successfully, but the document list could not refresh. Please refresh the list and try again."
      );
    } catch (err) {
      setUploadError(err.message || "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(document) {
    setError("");
    setMessage("");

    try {
      const response = await api.downloadDocument(document.id);

      if (!response.ok) {
        let details = null;

        try {
          details = await response.json();
        } catch {
          // The server may return a non-JSON error.
        }

        throw new Error(
          details?.error || `Download failed (${response.status})`
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");

      link.href = url;
      link.download = document.filename;
      window.document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`Downloaded ${document.filename}.`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleView(document) {
    setError("");
    setMessage("");

    const previewWindow = window.open("about:blank", "_blank");

    if (!previewWindow) {
      setError("The preview was blocked. Allow pop-ups and try again.");
      return;
    }

    try {
      const response = await api.viewDocument(document.id);

      if (!response.ok) {
        let details = null;

        try {
          details = await response.json();
        } catch {
          // The server may return a non-JSON error.
        }

        throw new Error(
          details?.error || `Preview failed (${response.status})`
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      previewWindow.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      previewWindow.close();
      setError(err.message);
    }
  }

  async function handleDelete(document) {
    const confirmed = window.confirm(
      `Delete "${document.filename}" permanently? This cannot be undone.`
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await api.deleteDocument(document.id);

      setDocuments((current) =>
        current.filter((item) => item.id !== document.id)
      );

      setMessage(result.message || "Document deleted successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await api.logout();

      setUser(null);
      setDocuments([]);
      setPage("login");
      setEmail("");
      setPassword("");
      setSelectedFile(null);
      setShowUploadDialog(false);
      setUploadError("");
      setMessage("You've logged out.");
    } catch (err) {
      setError(`Couldn't log out: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  const authProps = {
    name,
    email,
    password,
    confirmPassword,
    busy,
    onNameChange: setName,
    onEmailChange: setEmail,
    onPasswordChange: setPassword,
    onConfirmPasswordChange: setConfirmPassword,
    onSubmit: handleAuth,
    onModeChange: changePage,
  };

  function renderWorkspacePage() {
    if (page === "dashboard") {
      return (
        <Dashboard
          user={user}
          documents={documents}
          onNavigate={changePage}
          onUploadClick={openFilePicker}
          onView={handleView}
          onDownload={handleDownload}
          busy={busy}
        />
      );
    }

    if (page === "documents") {
      return (
        <DocumentsPage
          documents={documents}
          onDocumentsChanged={loadDocuments}
          onUploadClick={openFilePicker}
          onView={handleView}
          onDownload={handleDownload}
          busy={busy}
        />
      );
    }

    if (page === "shared") {
      return (
        <SharedPage
          onView={handleView}
          onDownload={handleDownload}
        />
      );
    }

    if (page === "activity") {
      return <ActivityPage />;
    }

    if (page === "admin") {
      if ((user?.role || "").toUpperCase() !== "ADMIN") {
        return (
          <section className="coming-soon">
            <h2>Access denied</h2>
            <p>Administrator access is required to view audit logs.</p>
            <button
              className="button button-primary"
              onClick={() => changePage("dashboard")}
            >
              Back to dashboard
            </button>
          </section>
        );
      }

      return <AdminAuditLogsPage />;
    }

    const pageInfo = {
      shared: {
        title: "Shared with me",
        description:
          "Find documents other people have shared with your account.",
      },
      activity: {
        title: "Activity",
        description:
          "Review document activity and access changes.",
      },
      admin: {
        title: "Audit logs",
        description:
          "Review recorded system activity as an administrator.",
      },
    };

    const info = pageInfo[page] || pageInfo.shared;

    return (
      <section className="coming-soon">
        <div className="coming-soon-icon">
          {page === "admin" ? (
            <ShieldCheck size={28} />
          ) : (
            <Files size={28} />
          )}
        </div>

        <h2>{info.title}</h2>
        <p>{info.description}</p>

        <p className="coming-soon-note">
          This section is not connected to the backend yet.
        </p>

        <button
          className="button button-primary"
          onClick={() => changePage("dashboard")}
        >
          Back to dashboard
        </button>
      </section>
    );
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <div className="auth-brand">
          <div className="brand-mark">
            <ShieldCheck size={23} />
          </div>
          <div className="brand-copy">
            <strong>TrustVault</strong>
            <span>Secure document workspace</span>
          </div>
        </div>

        <div className="auth-content">
          <Notice error={error} message={message} />

          {page === "register" ? (
            <RegisterPage {...authProps} />
          ) : (
            <LoginPage {...authProps} />
          )}
        </div>

        <footer className="auth-footer">
          TrustVault · Private by design · API {apiStatus}
        </footer>
      </main>
    );
  }

  return (
    <>
      <AppLayout
        activePage={page}
        onNavigate={changePage}
        user={user}
        onLogout={handleLogout}
      >
        <Notice error={error || documentError} message={message} />
        {renderWorkspacePage()}
      </AppLayout>

      <input
        ref={fileInputRef}
        className="visually-hidden-file-input"
        type="file"
        onChange={handleFileSelection}
        aria-label="Choose a document to upload"
      />

      {showUploadDialog && selectedFile && (
        <div className="upload-dialog-overlay">
          <section
            className="upload-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-dialog-title"
          >
            <div className="upload-dialog-header">
              <div className="upload-dialog-heading">
                <div className="upload-dialog-icon">
                  <UploadCloud size={22} />
                </div>
                <div>
                  <h2 id="upload-dialog-title">Upload document</h2>
                  <p>Choose a category before uploading.</p>
                </div>
              </div>

              <button
                type="button"
                className="upload-dialog-close"
                onClick={closeUploadDialog}
                disabled={busy}
                aria-label="Close upload dialog"
              >
                <X size={20} />
              </button>
            </div>

            <div className="upload-dialog-file">
              <Files size={20} />
              <div className="upload-dialog-filename">
                <strong>{selectedFile.name}</strong>
                <span>
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </span>
              </div>
            </div>

            <div className="upload-dialog-field">
              <label htmlFor="upload-category">
                Document category
              </label>
              <select
                id="upload-category"
                value={uploadCategory}
                onChange={(event) =>
                  setUploadCategory(event.target.value)
                }
                disabled={busy}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {uploadError && (
              <p className="upload-dialog-error" role="alert">
                {uploadError}
              </p>
            )}

            <div className="upload-dialog-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={closeUploadDialog}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                type="button"
                className="button button-primary"
                onClick={handleUpload}
                disabled={busy || !selectedFile}
              >
                {busy ? "Uploading..." : "Upload document"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default App;
