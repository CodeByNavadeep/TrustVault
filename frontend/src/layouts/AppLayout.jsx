
import { useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";

export default function AppLayout({
  activePage,
  onNavigate,
  user,
  onLogout,
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="workspace">
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        user={user}
        onLogout={onLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="workspace-main">
        <Topbar
          activePage={activePage}
          user={user}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="workspace-content">{children}</main>
      </div>
    </div>
  );
}
