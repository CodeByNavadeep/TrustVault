
import { useCallback, useEffect, useState } from "react";
import "./css/App.css";

import Header from "./components/Header";
import Notice from "./components/Notice";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import { api } from "./services/api";

function App() {
  const [apiStatus, setApiStatus] = useState("Checking...");
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [documentError, setDocumentError] = useState("");
  const [page, setPage] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadDocuments = useCallback(async () => {
    setDocumentError("");

    try {
      const data = await api.getDocuments();
      setDocuments(data.documents || []);
    } catch (err) {
      setDocumentError(`Couldn't load documents: ${err.message}`);
    }
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      const currentUser = await api.me();

      setUser(currentUser);
      setPage("dashboard");

      // A document-loading error must not log the user out.
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
          setApiStatus(health.status === "ok" ? "Connected" : "Unavailable");
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
  }

  async function handleAuth(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (page === "register") {
        await api.register(email, password);

        setPage("login");
        setPassword("");
        setMessage("Account created. You can now log in.");
        return;
      }

      // First authenticate; then verify that the session cookie works.
      await api.login(email, password);
      const currentUser = await api.me();

      // Show the dashboard as soon as authentication is confirmed.
      setUser(currentUser);
      setPage("dashboard");
      setEmail("");
      setPassword("");
      setMessage("Welcome to TrustVault.");

      // This operation handles its own errors and cannot undo the login.
      await loadDocuments();
    } catch (err) {
      setError(
        page === "login" && !user && err.status !== 401
          ? err.message
          : err.message
      );
    } finally {
      setBusy(false);
    }
  }

async function handleUpload(event) {
  event.preventDefault();

  if (!selectedFile) {
    setError("Choose a file to upload.");
    return;
  }

  // Save the form reference before any await.
  const form = event.currentTarget;

  setBusy(true);
  setError("");
  setMessage("");

  try {
    await api.uploadDocument(selectedFile);

    setSelectedFile(null);
    form.reset();

    await loadDocuments();
    setMessage("Document uploaded successfully.");
  } catch (err) {
    setError(err.message);
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
      URL.revokeObjectURL(url);

      setMessage(`Downloaded ${document.filename}.`);
    } catch (err) {
      setError(err.message);
    }
  }

async function handleView(document) {
  setError("");
  setMessage("");

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
    const previewWindow = window.open(url, "_blank", "noopener,noreferrer");

    if (!previewWindow) {
      URL.revokeObjectURL(url);
      throw new Error("The preview was blocked. Allow pop-ups and try again.");
    }

    // Give the new tab time to load the blob before releasing the URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
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
      setMessage("You've logged out.");
    } catch (err) {
      setError(`Couldn't log out: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  const authProps = {
    email,
    password,
    busy,
    onEmailChange: setEmail,
    onPasswordChange: setPassword,
    onSubmit: handleAuth,
    onModeChange: changePage,
  };

  return (
    <main className="app-shell">
      <Header apiStatus={apiStatus} />

      <section className="hero">
        <p className="eyebrow">PRIVATE DOCUMENT MANAGEMENT</p>
        <h1>
          Your documents.
          <br />
          Your control.
        </h1>
        <p className="hero-copy">
          A secure space for your files, with access limited to the people
          who are allowed to see them.
        </p>
      </section>

      <Notice error={error} message={message} />

      {user ? (
        <DashboardPage
          user={user}
          documents={documents}
          selectedFile={selectedFile}
          onFileChange={setSelectedFile}
          onUpload={handleUpload}
          onDownload={handleDownload}
          onView={handleView}
          onDelete={handleDelete}
          onLogout={handleLogout}
          busy={busy}
          documentError={documentError}
        />
      ) : page === "register" ? (
        <RegisterPage {...authProps} />
      ) : (
        <LoginPage {...authProps} />
      )}

      <footer className="footer">
        TrustVault <span>·</span> Private by design
      </footer>
    </main>
  );
}

export default App;
