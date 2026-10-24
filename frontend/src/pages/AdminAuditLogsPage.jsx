
import { useCallback, useEffect, useState } from "react";
import {
    Download,
    Eye,
    FileText,
    RefreshCw,
    ShieldCheck,
    UserRound,
} from "lucide-react";

import { api } from "../services/api";

function formatEventType(eventType = "") {
    return eventType
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function getEventStatus(log) {
    const details = log.details || {};
    const eventType = (log.event_type || "").toUpperCase();
    const outcome = String(details.outcome || "").toUpperCase();
    const statusCode = Number(details.status_code || 0);

    const isDenied =
        outcome === "DENIED" ||
        eventType.endsWith("_DENIED") ||
        (statusCode >= 400 && statusCode <= 599);

    return isDenied ? "denied" : "success";
}

function getEventIcon(eventType = "") {
    if (eventType.includes("DOWNLOADED")) return Download;
    if (eventType.includes("VIEWED")) return Eye;
    if (eventType.includes("ACCESS_")) return ShieldCheck;
    return FileText;
}

function formatDate(dateString) {
    if (!dateString) return "Date unavailable";

    const date = new Date(dateString);

    return Number.isNaN(date.getTime())
        ? "Date unavailable"
        : date.toLocaleString();
}

function formatDetailKey(key = "") {
    return key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDetails(details) {
    if (!details || typeof details !== "object") {
        return details ? String(details) : "No additional details";
    }

    const entries = Object.entries(details);

    if (entries.length === 0) return "No additional details";

    return (
        entries
            .filter(([key]) => !["recipient_id", "recipientId"].includes(key))
            .map(([key, value]) => {
                const label = formatDetailKey(key);

                if (value === null || value === undefined || value === "") {
                    return `${label}: —`;
                }

                if (typeof value === "object") {
                    return `${label}: ${JSON.stringify(value)}`;
                }

                return `${label}: ${String(value)}`;
            })
            .join(" · ") || "No additional details"
    );
}

function ActivityTable({ rows, authentication = false }) {
    if (rows.length === 0) {
        return (
            <div className="empty-state">
                {authentication ? <UserRound size={30} /> : <ShieldCheck size={30} />}
                <h3>
                    No {authentication ? "authentication" : "document"} activity found
                </h3>
                <p>Try changing or clearing your filters.</p>
            </div>
        );
    }

    return (
        <div className="activity-table-wrapper">
            <table className="activity-table">
                <thead>
                    <tr>
                        <th>Action</th>
                        <th>User</th>
                        {authentication ? (
                            <th>Email</th>
                        ) : (
                            <th>Document</th>
                        )}
                        <th>Date &amp; time</th>
                        <th>Details</th>
                    </tr>
                </thead>

                <tbody>
                    {rows.map((log) => {
                        const EventIcon = authentication
                            ? UserRound
                            : getEventIcon(log.event_type);

                        const status = getEventStatus(log);

                        return (
                            <tr
                                key={log.id}
                                className={
                                    getEventStatus(log) === "denied"
                                        ? "audit-row-denied"
                                        : "audit-row-success"
                                }
                            >
                                <td>
                                    <span className="activity-action">
                                        <EventIcon size={16} />
                                        <span>{formatEventType(log.event_type)}</span>
                                    </span>
                                </td>
                                <td>{log.actor_name || "Unknown user"}</td>

                                <td>
                                    {authentication
                                        ? log.actor_email || "Email unavailable"
                                        : log.document_name || "—"}
                                </td>

                                <td>{formatDate(log.created_at)}</td>

                                <td>
                                    <div className="activity-details">
                                        {formatDetails(log.details)}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function AdminAuditLogsPage() {
    const [documentActivity, setDocumentActivity] = useState([]);
    const [authenticationActivity, setAuthenticationActivity] = useState([]);

    const [eventType, setEventType] = useState("");
    const [actorName, setActorName] = useState("");
    const [documentName, setDocumentName] = useState("");
    const [limit, setLimit] = useState("50");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadLogs = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const data = await api.getAdminAuditLogs({
                event_type: eventType.trim(),
                actor_name: actorName.trim(),
                document_name: documentName.trim(),
                limit,
            });

            setDocumentActivity(data.document_activity || []);
            setAuthenticationActivity(data.authentication_activity || []);
        } catch (err) {
            setError(err.message || "Couldn't load audit logs.");
        } finally {
            setLoading(false);
        }
    }, [eventType, actorName, documentName, limit]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    function clearFilters() {
        setEventType("");
        setActorName("");
        setDocumentName("");
        setLimit("50");
    }

    const totalCount = documentActivity.length + authenticationActivity.length;

    return (
        <section className="page-section">
            <div className="page-header">
                <div>
                    <h1>Audit Logs</h1>
                    <p>
                        Monitor document activity and authentication events across TrustVault.
                    </p>
                </div>

                <button
                    type="button"
                    className="button button-secondary"
                    onClick={loadLogs}
                    disabled={loading}
                >
                    <RefreshCw size={16} />
                    {loading ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            <form
                className="audit-filters"
                onSubmit={(event) => {
                    event.preventDefault();
                    loadLogs();
                }}
            >
                <div className="audit-filter-field">
                    <label htmlFor="audit-event-type">Event type</label>
                    <input
                        id="audit-event-type"
                        value={eventType}
                        onChange={(event) => setEventType(event.target.value)}
                        placeholder="e.g. DOCUMENT_VIEWED"
                    />
                </div>

                <div className="audit-filter-field">
                    <label htmlFor="audit-actor-name">Filter by actor name</label>
                    <input
                        id="audit-actor-name"
                        type="text"
                        value={actorName}
                        onChange={(event) => setActorName(event.target.value)}
                        placeholder="Enter user name"
                    />
                </div>

                <div className="audit-filter-field">
                    <label htmlFor="audit-document-name">Filter by document name</label>
                    <input
                        id="audit-document-name"
                        type="text"
                        value={documentName}
                        onChange={(event) => setDocumentName(event.target.value)}
                        placeholder="Enter document name"
                    />
                </div>

                <div className="audit-filter-field">
                    <label htmlFor="audit-limit">Results per table</label>
                    <select
                        id="audit-limit"
                        value={limit}
                        onChange={(event) => setLimit(event.target.value)}
                    >
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>
                </div>

                <div className="audit-filter-actions">
                    <button
                        type="submit"
                        className="button button-primary"
                        disabled={loading}
                    >
                        Apply filters
                    </button>

                    <button
                        type="button"
                        className="button button-secondary"
                        onClick={clearFilters}
                        disabled={loading}
                    >
                        Clear
                    </button>
                </div>
            </form>

            {error && (
                <div className="notice notice-error" role="alert">
                    {error}
                </div>
            )}

            {!error && (
                <>
                    <section className="audit-section">
                        <div className="page-header">
                            <div>
                                <h2>Document Activity</h2>
                                <p>
                                    Uploads, views, downloads, renames, deletions, and access changes.
                                </p>
                            </div>
                            <span className="activity-count">
                                {documentActivity.length} events
                            </span>
                        </div>

                        <ActivityTable rows={documentActivity} />
                    </section>

                    <section className="audit-section">
                        <div className="page-header">
                            <div>
                                <h2>Authentication Activity</h2>
                                <p>Account registration and login events.</p>
                            </div>
                            <span className="activity-count">
                                {authenticationActivity.length} events
                            </span>
                        </div>

                        <ActivityTable
                            rows={authenticationActivity}
                            authentication
                        />
                    </section>
                </>
            )}

            {loading && <p>Loading audit logs...</p>}

            {!loading && !error && (
                <p className="activity-count">
                    Showing {totalCount} events across both tables
                </p>
            )}
        </section>
    );
}

export default AdminAuditLogsPage;
