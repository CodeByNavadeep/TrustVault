
import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [apiStatus, setApiStatus] = useState("Checking API...");

  useEffect(() => {
    fetch("http://127.0.0.1:5000/api/health")
      .then((response) => {
        if (!response.ok) {
          throw new Error("API unavailable");
        }
        return response.json();
      })
      .then((data) => setApiStatus(data.status))
      .catch(() => setApiStatus("Disconnected"));
  }, []);

  return (
    <main>
      <p className="eyebrow">SECURE DOCUMENT PLATFORM</p>
      <h1>TrustVault</h1>
      <p>
        Your documents. Your permissions.
        An audit trail you can verify.
      </p>

      <section className="status">
        <span>Backend status</span>
        <strong>{apiStatus}</strong>
      </section>

      <p className="note">
        Security-first document sharing is being built.
      </p>
    </main>
  );
}

export default App;
