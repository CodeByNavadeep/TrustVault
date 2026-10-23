
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
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

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString();
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

  return entries
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
    .join(" · ") || "No additional details";
}


function ActivityPage() {
  const [activity, setActivity] = useState([]);
  const [eventFilter, setEventFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await api.getMyActivity();
      setActivity(data.activity || []);
    } catch (err) {
      setError(err.message || "Couldn't load your activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const eventTypes = [
    ...new Set(activity.map((item) => item.event_type).filter(Boolean)),
  ];

  const filteredActivity =
    eventFilter === "ALL"
      ? activity
      : activity.filter((item) => item.event_type === eventFilter);

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <h1>My Activity</h1>
          <p>Review actions you've performed in TrustVault.</p>
        </div>

        <button
          type="button"
          className="button button-secondary"
          onClick={loadActivity}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="activity-toolbar">
        <div>
          <label htmlFor="activity-filter">Filter by action</label>
          <select
            id="activity-filter"
            value={eventFilter}
            onChange={(event) => setEventFilter(event.target.value)}
          >
            <option value="ALL">All activity</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {formatEventType(type)}
              </option>
            ))}
          </select>
        </div>

        <p className="activity-count">
          {filteredActivity.length} event
          {filteredActivity.length === 1 ? "" : "s"}
        </p>
      </div>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && activity.length === 0 && (
        <div className="empty-state">
          <Activity size={30} />
          <h2>No activity yet</h2>
          <p>Your recorded actions will appear here.</p>
        </div>
      )}

      {!loading && !error && activity.length > 0 &&
        filteredActivity.length === 0 && (
          <div className="empty-state">
            <Activity size={30} />
            <h2>No matching activity</h2>
            <p>Choose another action from the filter.</p>
          </div>
        )}

      {filteredActivity.length > 0 && (
        <div className="activity-table-wrapper">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Document</th>
                <th>Date &amp; time</th>
                <th>Details</th>
              </tr>
            </thead>

            <tbody>
              {filteredActivity.map((item) => {
                const EventIcon = getEventIcon(item.event_type);

                return (
                  <tr key={item.id}>
                    <td>
                      <span className="activity-action">
                        <EventIcon size={16} />
                        <span>{formatEventType(item.event_type)}</span>
                      </span>
                    </td>

                    <td>
                      {item.document_name || "—"}
                    </td>

                    <td>{formatDate(item.created_at)}</td>

                    <td>
                      <div className="activity-details">
                        {formatDetails(item.details)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {loading && <p>Loading your activity...</p>}
    </section>
  );
}

export default ActivityPage;
