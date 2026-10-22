


export default function Header({ apiStatus }) {
  return (
    <header className="topbar">
      <a className="brand" href="#" onClick={(event) => event.preventDefault()}>
        <span className="brand-mark">T</span>
        <span>TrustVault</span>
      </a>

      <div className="api-indicator">
        <span
          className={`status-dot ${
            apiStatus === "Connected" ? "online" : ""
          }`}
        />
        API {apiStatus}
      </div>
    </header>
  );
}
