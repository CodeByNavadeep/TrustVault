
import { Menu, ShieldCheck } from "lucide-react";

const pageTitles = {
  dashboard: ["Dashboard", "Your secure workspace at a glance."],
  documents: ["My documents", "Organize and manage your files."],
  shared: ["Shared with me", "Documents others have shared with you."],
  activity: ["Activity", "Keep track of your document actions."],
  admin: ["Audit logs", "Review recorded system activity."],
};

export default function Topbar({ activePage, user, onMenuClick }) {
  const [title, subtitle] = pageTitles[activePage] || pageTitles.dashboard;

  return (
    <header className="topbar">
      <div className="topbar-heading">
        <button
          className="icon-button menu-button"
          aria-label="Open navigation"
          onClick={onMenuClick}
        >
          <Menu size={22} />
        </button>

        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="topbar-user">
        <div className="topbar-status">
          <ShieldCheck size={16} />
          <span>Secure workspace</span>
        </div>
        <div className="topbar-avatar">
          {(user?.email || "U").charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
