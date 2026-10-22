
import { useCallback, useEffect, useState } from "react";
import {
    Download,
    Eye,
    FileText,
    RefreshCw,
    ShieldCheck,
} from "lucide-react";

import { api } from "../services/api";

function formatEventType(eventType = "") {
    return eventType
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
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

function AdminAuditLogsPage() {
    const [logs, setLogs] = useState([]);
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

            setLogs(data.audit_logs || []);
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
        setActorId("");
        setDocumentId("");
        setLimit("50");
    }

    return (
        <section className="page-section">
            <div className="page-header">
                <div>
                    <h1>Audit Logs</h1>
                    <p>Monitor recorded document and access events across TrustVault.</p>
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
                    <label htmlFor="audit-limit">Results</label>
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

            {!loading && !error && logs.length === 0 && (
                <div className="empty-state">
                    <ShieldCheck size={30} />
                    <h2>No audit logs found</h2>
                    <p>Try changing or clearing your filters.</p>
                </div>
            )}

            {logs.length > 0 && (
                <div className="activity-table-wrapper">
                    <table className="activity-table">
                        <thead>
                            <tr>
                                <th>Action</th>
                                <th>Actor</th>
                                <th>Document</th>
                                <th>Date &amp; time</th>
                                <th>Details</th>
                            </tr>
                        </thead>

                        <tbody>
                            {logs.map((log) => {
                                const EventIcon = getEventIcon(log.event_type);

                                return (
                                    <tr key={log.id}>
                                        <td>
                                            <span className="activity-action">
                                                <EventIcon size={16} />
                                                <span>{formatEventType(log.event_type)}</span>
                                            </span>
                                        </td>

                                        <td>{log.actor_name || "Unknown user"}</td>

                                        <td>{log.document_name || "—"}</td>

                                        <td>{formatDate(log.created_at)}</td>

                                        <td>
                                            <details className="activity-details">
                                                <summary>View</summary>
                                                <pre>
                                                    {JSON.stringify(log.details || {}, null, 2)}
                                                </pre>
                                            </details>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {loading && <p>Loading audit logs...</p>}

            {!loading && !error && logs.length > 0 && (
                <p className="activity-count">
                    Showing {logs.length} audit event{logs.length === 1 ? "" : "s"}
                </p>
            )}
        </section>
    );
}

export default AdminAuditLogsPage;
