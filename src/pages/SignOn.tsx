import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

const SignOn = () => {
  const [tab, setTab] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [magicLink, setMagicLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError("Google sign-in failed. Please try again.");
      }
      if (result.redirected) return;
    } catch {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    setError("");
    if (!email) { setError("Email is required"); return; }

    setLoading(true);
    try {
      if (magicLink) {
        const { error: err } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
        setMagicLinkSent(true);
      } else {
        if (!password) { setError("Password is required"); setLoading(false); return; }
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) {
          if (err.message.includes("Invalid login")) setError("Invalid email or password");
          else setError(err.message);
        }
      }
    } catch (e: any) {
      setError(e.message || "Connection error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError("");
    if (!displayName) { setError("Name is required"); return; }
    if (!email) { setError("Email is required"); return; }
    if (!password || password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }

    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: displayName } },
      });
      if (err) {
        if (err.message.includes("already registered")) setError("An account with this email already exists");
        else setError(err.message);
      } else {
        setRegistered(true);
      }
    } catch (e: any) {
      setError(e.message || "Connection error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "#111110",
    border: "1px solid rgba(201,168,76,0.3)",
    color: "#e0d8c0",
    fontFamily: "Courier New, monospace",
    fontSize: 13,
    minHeight: 44,
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#080806" }}>
      <div
        className="w-full max-w-[420px] mx-4 rounded-lg overflow-hidden"
        style={{
          border: "1px solid rgba(201,168,76,0.3)",
          background: "#0D0D0B",
          boxShadow: "0 0 40px rgba(201,168,76,0.05)",
        }}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-4 text-center">
          <h1 className="text-lg font-bold tracking-[3px]" style={{ color: "#C9A84C", fontFamily: "Courier New, monospace" }}>
            IMPERIAL PRICE TERMINAL
          </h1>
          <p className="text-[11px] tracking-wider mt-1" style={{ color: "#e0d8c0", opacity: 0.7 }}>
            Kenner Vintage Darth Vader — Auction Price Tracker
          </p>
          <div className="mt-3 h-px" style={{ background: "rgba(201,168,76,0.3)" }} />
          <span className="text-[10px] tracking-widest" style={{ color: "#C9A84C", opacity: 0.4 }}>v4.1</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: "rgba(201,168,76,0.2)" }}>
          <button
            onClick={() => { setTab("signin"); setError(""); setMagicLink(false); setMagicLinkSent(false); }}
            className="flex-1 py-3 text-[11px] font-bold tracking-widest transition-colors"
            style={{
              color: tab === "signin" ? "#C9A84C" : "rgba(224,216,192,0.5)",
              borderBottom: tab === "signin" ? "2px solid #C9A84C" : "2px solid transparent",
              minHeight: 44,
            }}
          >
            SIGN IN
          </button>
          <button
            onClick={() => { setTab("register"); setError(""); setRegistered(false); }}
            className="flex-1 py-3 text-[11px] font-bold tracking-widest transition-colors"
            style={{
              color: tab === "register" ? "#C9A84C" : "rgba(224,216,192,0.5)",
              borderBottom: tab === "register" ? "2px solid #C9A84C" : "2px solid transparent",
              minHeight: 44,
            }}
          >
            REGISTER
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {/* Google Sign-In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded text-sm font-medium transition-opacity"
            style={{
              background: "#ffffff",
              color: "#333333",
              minHeight: 44,
              opacity: loading ? 0.5 : 1,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {tab === "signin" ? "Sign in with Google" : "Sign up with Google"}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "rgba(201,168,76,0.2)" }} />
            <span className="text-[10px] tracking-wider" style={{ color: "rgba(201,168,76,0.4)" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "rgba(201,168,76,0.2)" }} />
          </div>

          {tab === "signin" ? (
            magicLinkSent ? (
              <p className="text-center text-sm" style={{ color: "#C9A84C" }}>
                Check your inbox — we've sent you a sign-in link
              </p>
            ) : (
              <>
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                  className="w-full px-4 py-3 rounded mb-3"
                  style={inputStyle}
                />
                {!magicLink && (
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                    className="w-full px-4 py-3 rounded mb-3"
                    style={inputStyle}
                  />
                )}
                <button
                  onClick={handleSignIn}
                  disabled={loading}
                  className="w-full py-3 rounded text-xs font-bold tracking-widest mb-3"
                  style={{
                    background: "#C9A84C",
                    color: "#080806",
                    opacity: loading ? 0.5 : 1,
                    minHeight: 44,
                  }}
                >
                  {loading ? "SIGNING IN…" : magicLink ? "SEND MAGIC LINK" : "SIGN IN"}
                </button>
                <button
                  onClick={() => { setMagicLink(!magicLink); setError(""); }}
                  className="w-full text-center text-[11px] tracking-wider py-2"
                  style={{ color: "#C9A84C", opacity: 0.7, minHeight: 44 }}
                >
                  {magicLink ? "Use password instead" : "Send me a magic link instead"}
                </button>
              </>
            )
          ) : registered ? (
            <p className="text-center text-sm leading-relaxed" style={{ color: "#C9A84C" }}>
              Account created — your access is pending approval. You'll receive an email when your account has been reviewed.
            </p>
          ) : (
            <>
              <input
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 rounded mb-3"
                style={inputStyle}
              />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded mb-3"
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded mb-3"
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                className="w-full px-4 py-3 rounded mb-3"
                style={inputStyle}
              />
              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full py-3 rounded text-xs font-bold tracking-widest"
                style={{
                  background: "#C9A84C",
                  color: "#080806",
                  opacity: loading ? 0.5 : 1,
                  minHeight: 44,
                }}
              >
                {loading ? "CREATING…" : "CREATE ACCOUNT"}
              </button>
            </>
          )}

          {/* Error */}
          {error && (
            <p className="mt-3 text-center text-[12px] animate-in fade-in" style={{ color: "#cc4444" }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignOn;
