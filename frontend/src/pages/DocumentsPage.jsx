import { useEffect, useMemo, useState } from "react";
import {
    Search,
    UploadCloud,
    FileText,
    Image as ImageIcon,
    File as FileIcon,
    Download,
    Eye,
    Pencil,
    Trash2,
    RefreshCw,
    Files,
    Share2,
    X,
} from "lucide-react";
import { api } from "../services/api";

const DEFAULT_CATEGORIES = [
    "Contracts",
    "Reports",
    "Finance",
    "Personal",
    "Work",
    "Other",
    "Uncategorized",
];

function formatSize(bytes = 0) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(filename = "") {
    const extension = filename.split(".").pop()?.toLowerCase();

    if (extension === "pdf") return FileText;

    if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension)) {
        return ImageIcon;
    }

    return FileIcon;
}

function formatDate(value) {
    if (!value) return "Date unavailable";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Date unavailable";

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function getShareEmail(share) {
    return (
        share.recipient_email ??
        share.email ??
        share.recipient?.email ??
        "Unknown recipient"
    );
}

function getRecipientId(share) {
    return (
        share.recipient_id ??
        share.user_id ??
        share.recipient?.id ??
        null
    );
}

export default function DocumentsPage({
    documents = [],
    onDocumentsChanged,
    onUploadClick,
    onView,
    onDownload,
    busy = false,
}) {
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("");
    const [owner, setOwner] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [filteredDocuments, setFilteredDocuments] = useState(documents);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [newFilename, setNewFilename] = useState("");
    const [actionBusy, setActionBusy] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Manage Access state
    const [sharingDocument, setSharingDocument] = useState(null);
    const [shares, setShares] = useState([]);
    const [shareEmail, setShareEmail] = useState("");
    const [sharePermission, setSharePermission] = useState("READ");
    const [sharesLoading, setSharesLoading] = useState(false);
    const [shareBusy, setShareBusy] = useState(false);
    const [shareError, setShareError] = useState("");
    const [shareMessage, setShareMessage] = useState("");

    const categories = useMemo(() => {
        return [
            ...new Set([
                ...DEFAULT_CATEGORIES,
                ...documents.map((doc) => doc.category).filter(Boolean),
            ]),
        ].sort((a, b) => a.localeCompare(b));
    }, [documents]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setSearchQuery(search.trim());
        }, 300);

        return () => window.clearTimeout(timer);
    }, [search]);

    async function fetchDocuments(showLoader = true) {
        if (showLoader) setLoading(true);

        setError("");

        try {
            const result = await api.getDocuments({
                q: searchQuery,
                category,
                owner: owner.trim(),
                date_from: dateFrom,
                date_to: dateTo,
            });

            setFilteredDocuments(result?.documents || []);
        } catch (err) {
            setError(err.message || "Unable to load documents.");
        } finally {
            if (showLoader) setLoading(false);
        }
    }

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError("");

            try {
                const result = await api.getDocuments({
                    q: searchQuery,
                    category,
                    owner: owner.trim(),
                    date_from: dateFrom,
                    date_to: dateTo,
                });

                if (!cancelled) {
                    setFilteredDocuments(result?.documents || []);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err.message || "Unable to load documents.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, [searchQuery, category, owner, dateFrom, dateTo]);

    async function refreshDocuments() {
        setLoading(true);
        setError("");
        setMessage("");

        try {
            await onDocumentsChanged?.();
            await fetchDocuments(false);
        } catch (err) {
            setError(err.message || "Unable to refresh documents.");
        } finally {
            setLoading(false);
        }
    }

    async function handleRename(document) {
        const filename = newFilename.trim();

        if (!filename) {
            setError("Enter a filename.");
            return;
        }

        if (filename.length > 255) {
            setError("Filename must be 255 characters or fewer.");
            return;
        }

        if (filename === document.filename) {
            setEditingId(null);
            setNewFilename("");
            return;
        }

        setActionBusy(true);
        setError("");
        setMessage("");

        try {
            await api.renameDocument(document.id, filename);

            setEditingId(null);
            setNewFilename("");
            setMessage("Document renamed successfully.");

            await refreshDocuments();
        } catch (err) {
            setError(err.message || "Unable to rename document.");
        } finally {
            setActionBusy(false);
        }
    }

    async function handleDelete(document) {
        const confirmed = window.confirm(
            `Delete "${document.filename}"? This action cannot be undone.`,
        );

        if (!confirmed) return;

        setActionBusy(true);
        setError("");
        setMessage("");

        try {
            await api.deleteDocument(document.id);

            setFilteredDocuments((current) =>
                current.filter((item) => item.id !== document.id),
            );

            setMessage("Document deleted successfully.");

            await onDocumentsChanged?.();
            await fetchDocuments(false);
        } catch (err) {
            setError(err.message || "Unable to delete document.");
        } finally {
            setActionBusy(false);
        }
    }

    // Manage Access functions
    async function loadShares(document) {
        setSharesLoading(true);
        setShareError("");
        setShares([]);

        try {
            const result = await api.getDocumentShares(document.id);

            const items = Array.isArray(result)
                ? result
                : result?.shares ?? result?.recipients ?? [];

            setShares(Array.isArray(items) ? items : []);
        } catch (err) {
            setShareError(err.message || "Unable to load the access list.");
        } finally {
            setSharesLoading(false);
        }
    }

    async function openManageAccess(document) {
        setSharingDocument(document);
        setShareEmail("");
        setSharePermission("READ");
        setShares([]);
        setShareError("");
        setShareMessage("");

        await loadShares(document);
    }

    async function handleShareSubmit(event) {
        event.preventDefault();

        if (!sharingDocument) return;

        const email = shareEmail.trim();

        if (!email) {
            setShareError("Enter the recipient's email address.");
            return;
        }

        setShareBusy(true);
        setShareError("");
        setShareMessage("");

        try {
            await api.shareDocument(
                sharingDocument.id,
                email,
                sharePermission,
            );

            setShareEmail("");
            setShareMessage(`Access granted to ${email}.`);

            await loadShares(sharingDocument);
            await onDocumentsChanged?.();
        } catch (err) {
            setShareError(err.message || "Unable to grant access.");
        } finally {
            setShareBusy(false);
        }
    }

    async function handleRevokeShare(share) {
        if (!sharingDocument) return;

        const recipientId = getRecipientId(share);

        if (recipientId == null) {
            setShareError(
                "The access list did not include a recipient ID, so access cannot be revoked from this entry.",
            );
            return;
        }

        const recipientEmail = getShareEmail(share);

        const confirmed = window.confirm(
            `Revoke access for ${recipientEmail}? They will no longer be able to access this document through this share.`,
        );

        if (!confirmed) return;

        setShareBusy(true);
        setShareError("");
        setShareMessage("");

        try {
            await api.revokeDocumentShare(
                sharingDocument.id,
                recipientId,
            );

            setShareMessage(`Access revoked for ${recipientEmail}.`);

            await loadShares(sharingDocument);
            await onDocumentsChanged?.();
        } catch (err) {
            setShareError(err.message || "Unable to revoke access.");
        } finally {
            setShareBusy(false);
        }
    }

    function closeManageAccess() {
        if (shareBusy) return;

        setSharingDocument(null);
        setShares([]);
        setShareEmail("");
        setShareError("");
        setShareMessage("");
    }

    function clearFilters() {
        setSearch("");
        setCategory("");
        setOwner("");
        setDateFrom("");
        setDateTo("");
        setError("");
        setMessage("");
    }

    return (
        <div className="dashboard-page documents-page">
            <section className="dashboard-section">
                <div className="section-heading">
                    <div>
                        <h2>Document library</h2>
                        <p>
                            Search and manage documents you own or can access.
                        </p>
                    </div>

                    <button
                        className="button button-primary"
                        onClick={onUploadClick}
                        disabled={busy || actionBusy}
                        type="button"
                    >
                        <UploadCloud size={17} />
                        Upload document
                    </button>
                </div>

                <div className="document-filters">
                    <label className="document-search">
                        <Search size={17} />
                        <input
                            type="search"
                            placeholder="Search filenames..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </label>

                    <label>
                        <span>Category</span>
                        <select
                            value={category}
                            onChange={(event) => setCategory(event.target.value)}
                        >
                            <option value="">All categories</option>
                            {categories.map((item) => (
                                <option value={item} key={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        <span>Owner email</span>
                        <input
                            type="text"
                            placeholder="Filter by owner"
                            value={owner}
                            onChange={(event) => setOwner(event.target.value)}
                        />
                    </label>

                    <label>
                        <span>Created from</span>
                        <input
                            type="date"
                            value={dateFrom}
                            max={dateTo || undefined}
                            onChange={(event) => setDateFrom(event.target.value)}
                        />
                    </label>

                    <label>
                        <span>Created to</span>
                        <input
                            type="date"
                            value={dateTo}
                            min={dateFrom || undefined}
                            onChange={(event) => setDateTo(event.target.value)}
                        />
                    </label>

                    <button
                        className="button button-secondary"
                        onClick={clearFilters}
                        type="button"
                    >
                        Clear filters
                    </button>
                </div>

                {error && (
                    <div className="notice notice-error" role="alert">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="notice notice-success" role="status">
                        {message}
                    </div>
                )}

                <div className="document-library-toolbar">
                    <span>
                        {loading
                            ? "Loading documents..."
                            : `${filteredDocuments.length} document${filteredDocuments.length === 1 ? "" : "s"}`}
                    </span>

                    <button
                        className="button button-secondary"
                        onClick={refreshDocuments}
                        disabled={loading || actionBusy}
                        type="button"
                    >
                        <RefreshCw size={15} />
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="empty-state" role="status">
                        <RefreshCw size={24} />
                        <p>Loading your library...</p>
                    </div>
                ) : filteredDocuments.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <Files size={28} />
                        </div>
                        <h3>No documents found</h3>
                        <p>
                            Try changing your search or filters, or upload a document.
                        </p>
                        <button
                            className="button button-secondary"
                            onClick={clearFilters}
                            type="button"
                        >
                            Clear filters
                        </button>
                    </div>
                ) : (
                    <div className="document-list">
                        {filteredDocuments.map((document) => {
                            const Icon = getFileIcon(document.filename);

                            const canRename =
                                document.permission === "OWNER" ||
                                document.permission === "EDIT";

                            const canDelete =
                                document.permission === "OWNER";

                            return (
                                <article
                                    className="recent-document"
                                    key={document.id}
                                >
                                    <div className="file-type-icon">
                                        <Icon size={21} />
                                    </div>

                                    <div className="recent-document-info">
                                        {editingId === document.id ? (
                                            <form
                                                onSubmit={(event) => {
                                                    event.preventDefault();
                                                    handleRename(document);
                                                }}
                                            >
                                                <input
                                                    aria-label="New filename"
                                                    value={newFilename}
                                                    maxLength={255}
                                                    onChange={(event) =>
                                                        setNewFilename(event.target.value)
                                                    }
                                                    autoFocus
                                                    disabled={actionBusy}
                                                />

                                                <button
                                                    className="button button-primary"
                                                    type="submit"
                                                    disabled={actionBusy}
                                                >
                                                    Save
                                                </button>

                                                <button
                                                    className="button button-secondary"
                                                    type="button"
                                                    disabled={actionBusy}
                                                    onClick={() => {
                                                        setEditingId(null);
                                                        setNewFilename("");
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            </form>
                                        ) : (
                                            <>
                                                <strong title={document.filename}>
                                                    {document.filename}
                                                </strong>

                                                <span>
                                                    {document.category || "Uncategorized"}{" "}
                                                    · {formatSize(document.file_size)} ·{" "}
                                                    {document.permission === "OWNER"
                                                        ? "Owned by you"
                                                        : `${document.permission} access`}
                                                </span>
                                            </>
                                        )}

                                        <span>{formatDate(document.created_at)}</span>
                                    </div>

                                    <div className="recent-document-actions">
                                        {document.permission === "OWNER" && (
                                            <button
                                                className="icon-button light-icon-button"
                                                title="Manage access"
                                                aria-label={`Manage access for ${document.filename}`}
                                                onClick={() =>
                                                    openManageAccess(document)
                                                }
                                                disabled={
                                                    actionBusy ||
                                                    shareBusy ||
                                                    busy
                                                }
                                                type="button"
                                            >
                                                <Share2 size={17} />
                                            </button>
                                        )}

                                        <button
                                            className="icon-button light-icon-button"
                                            title="Preview document"
                                            aria-label={`Preview ${document.filename}`}
                                            onClick={() => onView?.(document)}
                                            disabled={actionBusy || busy}
                                            type="button"
                                        >
                                            <Eye size={17} />
                                        </button>

                                        <button
                                            className="icon-button light-icon-button"
                                            title="Download document"
                                            aria-label={`Download ${document.filename}`}
                                            onClick={() => onDownload?.(document)}
                                            disabled={actionBusy || busy}
                                            type="button"
                                        >
                                            <Download size={17} />
                                        </button>

                                        {canRename && editingId !== document.id && (
                                            <button
                                                className="icon-button light-icon-button"
                                                title="Rename document"
                                                aria-label={`Rename ${document.filename}`}
                                                onClick={() => {
                                                    setEditingId(document.id);
                                                    setNewFilename(document.filename);
                                                    setError("");
                                                    setMessage("");
                                                }}
                                                disabled={actionBusy || busy}
                                                type="button"
                                            >
                                                <Pencil size={17} />
                                            </button>
                                        )}

                                        {canDelete && (
                                            <button
                                                className="icon-button light-icon-button"
                                                title="Delete document"
                                                aria-label={`Delete ${document.filename}`}
                                                onClick={() => handleDelete(document)}
                                                disabled={actionBusy || busy}
                                                type="button"
                                            >
                                                <Trash2 size={17} />
                                            </button>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}

                {/* Manage Access modal */}
                {sharingDocument && (
                    <div
                        className="share-modal-backdrop"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                                closeManageAccess();
                            }
                        }}
                    >
                        <section
                            className="share-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="share-modal-title"
                        >
                            <header className="share-modal-header">
                                <div>
                                    <h2 id="share-modal-title">
                                        Manage access
                                    </h2>
                                    <p title={sharingDocument.filename}>
                                        {sharingDocument.filename}
                                    </p>
                                </div>

                                <button
                                    className="icon-button light-icon-button"
                                    type="button"
                                    onClick={closeManageAccess}
                                    disabled={shareBusy}
                                    aria-label="Close manage access"
                                >
                                    <X size={19} />
                                </button>
                            </header>

                            <form
                                className="share-form"
                                onSubmit={handleShareSubmit}
                            >
                                <label>
                                    <span>Recipient email</span>
                                    <input
                                        type="email"
                                        value={shareEmail}
                                        onChange={(event) =>
                                            setShareEmail(event.target.value)
                                        }
                                        placeholder="person@example.com"
                                        required
                                        disabled={shareBusy}
                                    />
                                </label>

                                <label>
                                    <span>Permission</span>
                                    <select
                                        value={sharePermission}
                                        onChange={(event) =>
                                            setSharePermission(event.target.value)
                                        }
                                        disabled={shareBusy}
                                    >
                                        <option value="READ">
                                            READ — view and download
                                        </option>
                                        <option value="EDIT">
                                            EDIT — allowed modifications
                                        </option>
                                    </select>
                                </label>

                                <button
                                    className="button button-primary"
                                    type="submit"
                                    disabled={shareBusy || !shareEmail.trim()}
                                >
                                    <Share2 size={16} />
                                    {shareBusy ? "Please wait..." : "Grant access"}
                                </button>
                            </form>

                            {shareError && (
                                <div
                                    className="notice notice-error"
                                    role="alert"
                                >
                                    {shareError}
                                </div>
                            )}

                            {shareMessage && (
                                <div
                                    className="notice notice-success"
                                    role="status"
                                >
                                    {shareMessage}
                                </div>
                            )}

                            <div className="share-list-heading">
                                <h3>People with access</h3>
                                <span>{shares.length}</span>
                            </div>

                            {sharesLoading ? (
                                <div className="share-list-state" role="status">
                                    <RefreshCw size={18} />
                                    Loading access list...
                                </div>
                            ) : shares.length === 0 ? (
                                <div className="share-list-state">
                                    No one has been given access yet.
                                </div>
                            ) : (
                                <div className="share-recipient-list">
                                    {shares.map((share) => {
                                        const email = getShareEmail(share);
                                        const permission =
                                            share.permission ?? "READ";

                                        return (
                                            <article
                                                className="share-recipient"
                                                key={
                                                    share.id ??
                                                    getRecipientId(share) ??
                                                    email
                                                }
                                            >
                                                <div className="share-recipient-avatar">
                                                    {email.charAt(0).toUpperCase()}
                                                </div>

                                                <div className="share-recipient-info">
                                                    <strong title={email}>
                                                        {email}
                                                    </strong>
                                                    <span>
                                                        {permission === "EDIT"
                                                            ? "Can edit"
                                                            : "Can view and download"}
                                                    </span>
                                                </div>

                                                <span
                                                    className={`share-permission-badge ${
                                                        permission === "EDIT"
                                                            ? "is-edit"
                                                            : "is-read"
                                                    }`}
                                                >
                                                    {permission}
                                                </span>

                                                <button
                                                    className="button button-secondary share-revoke-button"
                                                    type="button"
                                                    disabled={shareBusy}
                                                    onClick={() =>
                                                        handleRevokeShare(share)
                                                    }
                                                >
                                                    Revoke
                                                </button>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}

                            <footer className="share-modal-footer">
                                <button
                                    className="button button-secondary"
                                    type="button"
                                    onClick={closeManageAccess}
                                    disabled={shareBusy}
                                >
                                    Close
                                </button>
                            </footer>
                        </section>
                    </div>
                )}
            </section>
        </div>
    );
}
