import React, { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  UserCheck
} from "lucide-react";
import { supabase, supabaseConfigured } from "../lib/supabase";

export function StaffLogin({ onSuccess, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "reset"
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setInfoMsg("");

    if (!supabase) {
      setError("Database service is not configured yet. Please check environment configuration.");
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid official email address.");
      return;
    }

    if (mode !== "reset" && (!password || password.length < 6)) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signin") {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        });
        if (loginError) throw loginError;
        if (data?.session) {
          onSuccess(data.session);
        }
      } else if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              display_name: cleanEmail === "dp844771@gmail.com"
                ? "Dhananjay Pawar (Super Admin)"
                : cleanEmail.split("@")[0]
            }
          }
        });
        if (signUpError) throw signUpError;

        if (data?.session) {
          onSuccess(data.session);
        } else {
          setInfoMsg(
            "Account registered successfully! If email confirmation is enabled, please verify your inbox before signing in. Note: Staff access activates only for pre-authorized accounts."
          );
          setMode("signin");
        }
      } else if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin + "/staff"
        });
        if (resetError) throw resetError;
        setInfoMsg(`A secure password reset link has been dispatched to ${cleanEmail}. Please check your inbox.`);
      }
    } catch (err) {
      const msg = err?.message || "Authentication request failed. Please check your credentials.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="staff-login-layout">
      <main className="staff-login-container">
        <div className="staff-login-card">
          <div className="staff-login-header">
            <div className="staff-crest-badge" aria-hidden="true">
              <ShieldCheck size={28} />
            </div>
            <p className="eyebrow">MGM UNIVERSITY · IICT ADMISSIONS</p>
            <h1>Staff &amp; Committee Portal</h1>
            <p className="staff-login-sub">
              Authorized portal for faculty, admissions counsellors, and administrators to review confidential applications and inquiries.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="staff-tabs-list" role="tablist" aria-label="Staff Authentication Mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              className={`staff-tab-btn ${mode === "signin" ? "active" : ""}`}
              onClick={() => {
                setMode("signin");
                setError("");
                setInfoMsg("");
              }}
            >
              <LogIn size={14} aria-hidden="true" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={`staff-tab-btn ${mode === "signup" ? "active" : ""}`}
              onClick={() => {
                setMode("signup");
                setError("");
                setInfoMsg("");
              }}
            >
              <UserCheck size={14} aria-hidden="true" />
              <span>Invited Staff Setup</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "reset"}
              className={`staff-tab-btn ${mode === "reset" ? "active" : ""}`}
              onClick={() => {
                setMode("reset");
                setError("");
                setInfoMsg("");
              }}
            >
              <KeyRound size={14} aria-hidden="true" />
              <span>Reset Password</span>
            </button>
          </div>

          {/* Alert Messages */}
          {error && (
            <div className="staff-alert-banner error" role="alert">
              <AlertCircle size={17} aria-hidden="true" />
              <div className="staff-alert-text">
                <strong>Authentication Notice</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          {infoMsg && (
            <div className="staff-alert-banner success" role="status">
              <CheckCircle2 size={17} aria-hidden="true" />
              <div className="staff-alert-text">
                <strong>Update</strong>
                <span>{infoMsg}</span>
              </div>
            </div>
          )}

          {/* Authentication Form */}
          <form className="staff-auth-form" onSubmit={handleSubmit} noValidate>
            <div className="staff-form-group">
              <label htmlFor="staff-email-input">Official Email Address</label>
              <div className="staff-input-wrapper">
                <Mail size={16} className="input-icon" aria-hidden="true" />
                <input
                  id="staff-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. staff@mgmu.ac.in"
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            {mode !== "reset" && (
              <div className="staff-form-group">
                <div className="staff-password-label-row">
                  <label htmlFor="staff-password-input">
                    {mode === "signup" ? "Set New Password" : "Password"}
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      className="staff-forgot-link"
                      onClick={() => {
                        setMode("reset");
                        setError("");
                        setInfoMsg("");
                      }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="staff-input-wrapper">
                  <Lock size={16} className="input-icon" aria-hidden="true" />
                  <input
                    id="staff-password-input"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "Create a strong password (min 6 chars)" : "Enter your account password"}
                    required
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="primary-button staff-submit-btn"
              disabled={!supabaseConfigured || loading}
            >
              {loading ? (
                <span>Processing request...</span>
              ) : mode === "signin" ? (
                <>
                  <LogIn size={16} aria-hidden="true" />
                  <span>Sign In to Dashboard</span>
                </>
              ) : mode === "signup" ? (
                <>
                  <ShieldCheck size={16} aria-hidden="true" />
                  <span>Activate Staff Account</span>
                </>
              ) : (
                <>
                  <KeyRound size={16} aria-hidden="true" />
                  <span>Send Password Reset Link</span>
                </>
              )}
            </button>
          </form>

          {/* Privacy & Governance Notice */}
          <div className="staff-policy-notice">
            <p>
              <strong>Access Governance:</strong> Only faculty and counsellors pre-authorized by the Super Admin receive admissions dashboard access. Public signups do not automatically receive staff permissions.
            </p>
          </div>

          <div className="staff-footer-action">
            <button type="button" className="staff-back-home-btn" onClick={onBack}>
              <ArrowLeft size={14} aria-hidden="true" />
              <span>Return to Admissions Home</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
