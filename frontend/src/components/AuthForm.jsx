

export default function AuthForm({
  mode,
  name,
  email,
  password,
  confirmPassword,
  busy,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onModeChange,
}) {
  const isRegister = mode === "register";

  function handleSubmit(event) {
    if (isRegister && password !== confirmPassword) {
      event.preventDefault();
      alert("Passwords do not match. Please try again.");
      return;
    }

    onSubmit(event);
  }

  return (
    <section className="auth-card">
      <div className="auth-tabs">
        <button
          type="button"
          className={!isRegister ? "tab active" : "tab"}
          onClick={() => onModeChange("login")}
        >
          Log in
        </button>

        <button
          type="button"
          className={isRegister ? "tab active" : "tab"}
          onClick={() => onModeChange("register")}
        >
          Create account
        </button>
      </div>

      <h2>{isRegister ? "Create your account" : "Welcome back"}</h2>

      <p className="muted">
        {isRegister
          ? "Start keeping your documents in one secure place."
          : "Log in to access your private documents."}
      </p>

      <form className="form" onSubmit={handleSubmit}>
        {isRegister && (
          <>
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Your full name"
              maxLength={100}
              required
            />
          </>
        )}

        <label htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="you@example.com"
          maxLength={255}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder={
            isRegister ? "At least 12 characters" : "Enter your password"
          }
          minLength={isRegister ? 12 : undefined}
          required
        />

        {isRegister && (
          <>
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) =>
                onConfirmPasswordChange(event.target.value)
              }
              placeholder="Enter your password again"
              minLength={12}
              required
            />
          </>
        )}

        <button className="primary-button" type="submit" disabled={busy}>
          {busy
            ? "Please wait..."
            : isRegister
              ? "Create account"
              : "Log in"}
        </button>
      </form>

      <p className="auth-footnote">
        Your session is managed by the TrustVault server.
      </p>
    </section>
  );
}
