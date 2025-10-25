import React, { useState } from "react";

// Small demo component that shows how to bootstrap CSRF, login (session cookie),
// and call a protected endpoint using fetch with credentials included.

export default function AuthDemo() {
  const [csrf, setCsrf] = useState<string | null>(null);
  const [username, setUsername] = useState("testuser");
  const [password, setPassword] = useState("pass123");
  const [message, setMessage] = useState<string | null>(null);

  const apiBase = "http://127.0.0.1:8000"; // adjust if your backend runs elsewhere

  async function bootstrapCsrf() {
    const res = await fetch(`${apiBase}/api/auth/csrf/`, {
      method: "GET",
      credentials: "include",
    });
    const data = await res.json();
    setCsrf(data.csrfToken || null);
    setMessage("CSRF token bootstrapped");
  }

  async function doLogin() {
    if (!csrf) {
      setMessage("Please bootstrap CSRF first");
      return;
    }
    const res = await fetch(`${apiBase}/api/auth/login/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrf,
      },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setMessage(`Login failed: ${err.detail || res.statusText}`);
      return;
    }
    const data = await res.json();
    setMessage(`Logged in as ${data.username}`);
  }

  async function useAction() {
    if (!csrf) {
      setMessage("Please bootstrap CSRF first");
      return;
    }
    const res = await fetch(`${apiBase}/api/auth/use_action/`, {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRFToken": csrf },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(`Action failed: ${data.detail || res.statusText}`);
      return;
    }
    setMessage(`Action OK: ${data.detail}`);
  }

  async function listUsers() {
    const res = await fetch(`${apiBase}/api/auth/users/`, {
      method: "GET",
      credentials: "include",
    });
    const data = await res.json().catch(() => []);
    setMessage(`Users: ${JSON.stringify(data)}`);
  }

  return (
    <div style={{ padding: 16, fontFamily: "sans-serif" }}>
      <h3>Auth demo (CSRF + session)</h3>
      <div style={{ marginBottom: 8 }}>
        <button onClick={bootstrapCsrf}>Bootstrap CSRF</button>
        <span style={{ marginLeft: 8 }}>{csrf ? "(got token)" : ""}</span>
      </div>

      <div style={{ marginBottom: 8 }}>
        <input value={username} onChange={(e: any) => setUsername(e.target.value)} />
        <input
          type="password"
          value={password}
          onChange={(e: any) => setPassword(e.target.value)}
          style={{ marginLeft: 8 }}
        />
        <button onClick={doLogin} style={{ marginLeft: 8 }}>
          Login
        </button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <button onClick={useAction}>Use Action (POST)</button>
        <button onClick={listUsers} style={{ marginLeft: 8 }}>
          List Users (GET)
        </button>
      </div>

      <div>
        <strong>Status:</strong>
        <pre style={{ whiteSpace: "pre-wrap" }}>{message}</pre>
      </div>
    </div>
  );
}
