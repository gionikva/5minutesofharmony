import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router";

export default function Navbar() {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [usernameDisplay, setUsernameDisplay] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const c = document.getElementById("nav-root");
    if (c) {
      // clear server-side fallback so our portal doesn't duplicate content
      c.innerHTML = "";
      setContainer(c);
      // Helpful debug to confirm portal mount in browser console
      // (will not run during SSR)
      // eslint-disable-next-line no-console
      console.debug("Navbar portal mounted", c);
    }
    // On mount, check auth by calling a protected endpoint. If it returns 200,
    // assume the session cookie is present and user is authenticated.
    (async function checkAuth() {
      try {
        const token = localStorage.getItem("token");
        const headers: Record<string, string> = token ? { Authorization: `Token ${token}` } : {};
        const r = await fetch("http://localhost:8000/api/auth/users/", {
          credentials: "include",
          headers,
        });
        if (r.ok) {
          setIsAuthenticated(true);
          // try to read user info if present
          const data = await r.json().catch(() => null);
          if (data && data.username) setUsernameDisplay(data.username);
        } else {
          setIsAuthenticated(false);
        }
      } catch (e) {
        setIsAuthenticated(false);
      }
    })();
  }, []);

  async function bootstrapCsrf() {
    const r = await fetch("http://localhost:8000/api/auth/csrf/", {
      credentials: "include",
    });
    if (!r.ok) throw new Error("Failed to get CSRF token");
    const data = await r.json();
    return data.csrfToken;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const csrfToken = await bootstrapCsrf();
      const res = await fetch("http://localhost:8000/api/auth/login/", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Login failed");
        setLoading(false);
        return;
      }

      // If backend returned a token (older branch), store it locally so we can
      // include it in future requests. Otherwise assume session cookie was set.
      if (data && data.token) {
        try {
          localStorage.setItem("token", data.token);
        } catch (e) {
          /* ignore storage errors */
        }
      }

      setOpen(false);
      setUsername("");
      setPassword("");
      setIsAuthenticated(true);
      if (data && data.username) setUsernameDisplay(data.username);
      navigate("/");
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    setError(null);
    try {
      const csrfToken = await bootstrapCsrf().catch(() => null);
      const res = await fetch("http://localhost:8000/api/auth/logout/", {
        method: "POST",
        credentials: "include",
        headers: csrfToken
          ? { "Content-Type": "application/json", "X-CSRFToken": csrfToken }
          : { "Content-Type": "application/json" },
      });
      // If logout endpoint isn't implemented, just clear client state
      if (res.ok || res.status === 404) {
        setIsAuthenticated(false);
        try {
          localStorage.removeItem("token");
        } catch (e) {}
        // reload to clear any server-side session-derived UI
        window.location.reload();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || "Logout failed");
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!container) return null;

  const loginUI = (
    <div className="relative flex items-center gap-2">
      {!isAuthenticated ? (
        <>
          <Link to="/register" className="px-3 py-1 rounded text-sm border border-white text-white bg-transparent hover:bg-white/10">
            Register
          </Link>
          <div className="relative">
            <button
              onClick={() => setOpen((s) => !s)}
              className="px-3 py-1 rounded text-sm border border-white text-white bg-transparent hover:bg-white/10"
              aria-expanded={open}
            >
              Log in
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-72 bg-gray-800 border border-gray-700 rounded shadow-lg z-30 p-3">
                <form onSubmit={(e) => handleSubmit(e)} className="space-y-3">
                  {error && <div className="text-sm text-red-400">{error}</div>}
                  <div>
                    <label className="block text-xs font-medium text-gray-200">Username</label>
                    <input
                      className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm text-white placeholder-gray-300"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete="username"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-200">Password</label>
                    <input
                      type="password"
                      className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm text-white placeholder-gray-300"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      type="submit"
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                      disabled={loading}
                    >
                      {loading ? "Signing in..." : "Sign in"}
                    </button>
                    <button type="button" className="text-sm text-gray-200" onClick={() => setOpen(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 rounded text-sm border border-white text-white bg-transparent" onClick={() => handleLogout()} disabled={loading}>
            Logout
          </button>
        </div>
      )}
    </div>
  );

  return createPortal(loginUI, container);
}
