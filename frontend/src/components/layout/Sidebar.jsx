
import {
  LayoutDashboard,
  Files,
  Users,
  Activity,
  ShieldCheck,
  X,
  LogOut,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard, path: "dashboard" },
  { label: "My documents", icon: Files, path: "documents" },
  { label: "Shared with me", icon: Users, path: "shared" },
  { label: "Activity", icon: Activity, path: "activity" },
];

export default function Sidebar({
  activePage,
  onNavigate,
  user,
  onLogout,
  open,
  onClose,
}) {
  const isAdmin = (user?.role || "").toUpperCase() === "ADMIN";

  function navigate(path) {
    onNavigate(path);
    onClose();
  }

  return (
    <>
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">
            <ShieldCheck size={23} />
          </div>
          <div className="brand-copy">
            <strong>TrustVault</strong>
            <span>Secure workspace</span>
          </div>

          <button
            className="icon-button sidebar-close"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-section-label">WORKSPACE</div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon, path }) => (
            <button
              key={path}
              className={`nav-item ${activePage === path ? "nav-item-active" : ""}`}
              onClick={() => navigate(path)}
              aria-current={activePage === path ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}

          {isAdmin && (
            <>
              <div className="sidebar-section-label admin-label">
                ADMINISTRATION
              </div>
              <button
                className={`nav-item ${
                  activePage === "admin" ? "nav-item-active" : ""
                }`}
                onClick={() => navigate("admin")}
                aria-current={activePage === "admin" ? "page" : undefined}
              >
                <ShieldCheck size={19} strokeWidth={1.8} />
                <span>Audit logs</span>
              </button>
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-security">
            <ShieldCheck size={19} />
            <div>
              <strong>Your files, protected</strong>
              <span>Access-controlled sharing</span>
            </div>
          </div>

          <div className="sidebar-user">
            <div className="user-avatar">
              {(user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <strong>{user?.name?.trim() || user?.email || "Signed-in user"}</strong>
              <span>{user?.role?.toUpperCase() === "ADMIN" ? "Administrator" : "User"}</span>
            </div>
            <button
              className="icon-button logout-button"
              aria-label="Log out"
              title="Log out"
              onClick={onLogout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
