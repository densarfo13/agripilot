/**
 * HomeAssistant — calm full-screen home surface.
 *
 * Standalone: fetches /api/decision/today on mount.
 * Integrated: receives decisionOverride from Dashboard (loop data).
 *
 * Fixed from user-supplied code:
 *   • style={[styles.online](…)} markdown artifacts → style={styles.online}
 *   • {[decision.weather](…)} artifact → {decision.weather}
 *   • @keyframes pulse was referenced but never defined → injected
 *   • Secondary button had no onClick → wired to onScan / navigate
 *   • fetch didn't check res.ok → throws on non-2xx, caught properly
 *   • No useNavigate import for scan routing → added
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// ── @keyframes pulse — inject once into <head> ───────────────────
// Referenced by styles.illustration animation string below.
// Injecting here keeps the component self-contained (no CSS file).
let _pulseInjected = false;
function _injectPulse() {
  if (_pulseInjected || typeof document === "undefined") return;
  _pulseInjected = true;
  try {
    if (document.querySelector("[data-ha-kf]")) return;
    const el = document.createElement("style");
    el.setAttribute("data-ha-kf", "1");
    el.textContent = `
      @keyframes pulse {
        0%   { transform: scale(1);    opacity: 0.85; }
        50%  { transform: scale(1.10); opacity: 1;    }
        100% { transform: scale(1);    opacity: 0.85; }
      }
    `;
    document.head.appendChild(el);
  } catch { /* swallow — never block render */ }
}

// Hardcoded fallback shown when the API is unreachable or slow.
const FALLBACK = {
  title:   "Check your plant today",
  reason:  "A quick check helps prevent problems",
  cta:     "Check now ✓",
  weather: "🌤️ Good day for a quick check",
};

/**
 * @param {object}   props
 * @param {object}   [props.decisionOverride]  Pre-fetched decision from Dashboard loop.
 *                                             When supplied, skips the /api/decision/today fetch.
 * @param {function} [props.onComplete]        Called on primary CTA tap (optional).
 *                                             When omitted, POSTs to /api/decision/complete.
 * @param {function} [props.onScan]            Called on scan button tap (optional).
 *                                             When omitted, navigates to /scan-crop.
 */
export default function HomeAssistant({
  decisionOverride = null,
  onComplete,
  onScan,
}) {
  const [decision,  setDecision]  = useState(decisionOverride || null);
  const [completed, setCompleted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    _injectPulse();

    // Skip fetch when parent already supplies decision data.
    if (decisionOverride) {
      setDecision(decisionOverride);
      return;
    }

    fetch("/api/decision/today")
      .then((res) => {
        // Bug fix: check res.ok before parsing — a 404 page
        // returns HTML that JSON.parse would throw on.
        if (!res.ok) throw new Error("not ok");
        return res.json();
      })
      .then((data) => setDecision(data && data.title ? data : FALLBACK))
      .catch(() => setDecision(FALLBACK));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update internal decision when parent passes new override data.
  useEffect(() => {
    if (decisionOverride) setDecision(decisionOverride);
  }, [decisionOverride]);

  const handleComplete = async () => {
    setCompleted(true);
    if (typeof onComplete === "function") {
      try { onComplete(); } catch { /* swallow */ }
      return;
    }
    // Standalone path: fire-and-forget POST.
    try {
      await fetch("/api/decision/complete", { method: "POST" });
    } catch { /* offline — local completed state already true */ }
  };

  const handleScan = () => {
    if (typeof onScan === "function") {
      try { onScan(); } catch { /* swallow */ }
      return;
    }
    // Standalone fallback: navigate directly.
    try { navigate("/scan-crop"); } catch { /* swallow */ }
  };

  // Show nothing while the decision is loading so there's no flash.
  if (!decision) return null;

  return (
    <div style={styles.container}>

      {/* TOP BAR */}
      <div style={styles.topBar}>
        <span style={styles.online}>● Online</span>
        <span>English</span>
      </div>

      {/* HERO */}
      <div style={styles.hero}>

        {/* WEATHER — always visible */}
        <div style={styles.weather}>
          {decision.weather || "🌤️ Good day for a quick check"}
        </div>

        {/* ILLUSTRATION */}
        <div style={styles.illustration}>🌱</div>

        {/* HEADLINE */}
        <h1 style={styles.title}>
          {completed ? "You're done for today 🌱" : decision.title}
        </h1>

        {/* SUBTEXT */}
        <p style={styles.subtitle}>
          {completed
            ? "Check again tomorrow morning"
            : decision.reason}
        </p>

        {/* PRIMARY CTA */}
        {!completed && (
          <button style={styles.primaryBtn} onClick={handleComplete}>
            {decision.cta}
          </button>
        )}

        {/* DONE STATE */}
        {completed && (
          <div style={styles.done}>
            ✓ Nice — you stayed ahead today
          </div>
        )}

        {/* SECONDARY ACTION — scan button (was missing onClick) */}
        {!completed && (
          <button style={styles.secondaryBtn} onClick={handleScan}>
            📷 Scan your plant
          </button>
        )}

      </div>
    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    background: "linear-gradient(180deg, #0b2d2a, #021a19)",
    color: "white",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "20px",
    // Ensure bottom nav doesn't overlap the CTA on mobile
    paddingBottom: "80px",
    boxSizing: "border-box",
  },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "14px",
    opacity: 0.8,
  },

  // Bug fix: was style={[styles.online](http://styles.online)} — markdown artifact
  online: {
    color: "#22c55e",
  },

  hero: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
  },

  // Bug fix: was {[decision.weather](http://decision.weather)} — markdown artifact
  weather: {
    marginBottom: "10px",
    opacity: 0.8,
  },

  title: {
    fontSize: "28px",
    fontWeight: "600",
    marginBottom: "10px",
  },

  subtitle: {
    fontSize: "16px",
    opacity: 0.7,
    marginBottom: "30px",
  },

  illustration: {
    fontSize: "60px",
    marginBottom: "30px",
    // Bug fix: @keyframes pulse is now injected by _injectPulse() above.
    // Without the injection this string was a no-op in the browser.
    animation: "pulse 3s ease-in-out infinite",
  },

  primaryBtn: {
    background: "#22c55e",
    border: "none",
    borderRadius: "30px",
    padding: "14px 30px",
    fontSize: "16px",
    color: "#000",
    marginBottom: "10px",
    cursor: "pointer",
    fontWeight: "700",
    minWidth: "180px",
    WebkitTapHighlightColor: "transparent",
  },

  secondaryBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "30px",
    padding: "12px 24px",
    color: "white",
    cursor: "pointer",
    fontSize: "15px",
    WebkitTapHighlightColor: "transparent",
    marginTop: "8px",
  },

  done: {
    marginTop: "20px",
    color: "#22c55e",
    fontSize: "16px",
    fontWeight: "600",
  },
};
