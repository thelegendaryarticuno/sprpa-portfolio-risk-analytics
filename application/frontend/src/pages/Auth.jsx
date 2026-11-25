import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, updateProfile } from "firebase/auth";
import { ArrowLeft, Loader2, Lock, Mail, User } from "lucide-react";
import { auth, googleProvider } from "../firebase";
import { useAuth } from "../state";
import { Aurora, Button, Logo, ThemeToggle } from "../ui";

const MSG = {
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/user-not-found": "Email or password is incorrect.",
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
  "auth/popup-closed-by-user": "Google sign-in was cancelled.",
  "auth/popup-blocked": "Your browser blocked the Google popup. Allow popups and retry.",
  "auth/operation-not-allowed": "This sign-in method is not enabled in the Firebase console.",
  "auth/unauthorized-domain": "This domain is not authorised in Firebase Authentication settings.",
  "auth/network-request-failed": "Network error. Check your connection.",
};

const Google = () => (
  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.1 7-10.2 7-17.6z" /><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" /></svg>
);

function Field({ icon: Icon, ...p }) {
  return (
    <div className="relative">
      <Icon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
      <input {...p} className="input pl-10" />
    </div>
  );
}

export default function Auth() {
  const { user } = useAuth();
  const [mode, setMode] = useState("in"); // in | up | reset
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (user) return <Navigate to="/app" replace />;

  const run = (fn) => async (e) => {
    e?.preventDefault();
    setBusy(true); setMsg(null);
    try { await fn(); } catch (er) { setMsg({ bad: true, text: MSG[er.code] || "Something went wrong. Please try again." }); }
    setBusy(false);
  };

  const submit = run(async () => {
    if (mode === "in") await signInWithEmailAndPassword(auth, f.email, f.password);
    else if (mode === "up") {
      const c = await createUserWithEmailAndPassword(auth, f.email, f.password);
      if (f.name.trim()) await updateProfile(c.user, { displayName: f.name.trim() });
    } else { await sendPasswordResetEmail(auth, f.email); setMsg({ text: "If an account exists, a reset link is on its way." }); }
  });
  const google = run(() => signInWithPopup(auth, googleProvider));
  const title = { in: "Welcome back", up: "Create your account", reset: "Reset password" }[mode];

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <Aurora />
      <div className="absolute left-5 top-5 z-10"><Link to="/" className="flex items-center gap-2 text-sm text-muted hover:text-fg"><ArrowLeft size={16} /> Back</Link></div>
      <div className="absolute right-5 top-5 z-10"><ThemeToggle /></div>
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }} className="relative w-full max-w-md">
        <div className="absolute -inset-px rounded-3xl bg-gradient-to-b from-brand/40 via-brand2/20 to-transparent blur-sm" />
        <div className="card relative rounded-3xl p-8 shadow-2xl">
          <Logo />
          <h1 className="mt-6 text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">{mode === "reset" ? "We'll email you a link to set a new password." : "Sign in to analyse your portfolio's risk."}</p>

          {mode !== "reset" && (
            <>
              <Button type="button" variant="ghost" size="lg" className="mt-6 w-full" onClick={google} disabled={busy}><Google /> Continue with Google</Button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted"><i className="h-px flex-1 bg-line" />or with email<i className="h-px flex-1 bg-line" /></div>
            </>
          )}

          <form onSubmit={submit} className={`space-y-3.5 ${mode === "reset" ? "mt-6" : ""}`}>
            {mode === "up" && <Field icon={User} placeholder="Full name" value={f.name} onChange={set("name")} autoComplete="name" />}
            <Field icon={Mail} type="email" required placeholder="Email address" value={f.email} onChange={set("email")} autoComplete="email" />
            {mode !== "reset" && <Field icon={Lock} type="password" required minLength={6} placeholder="Password" value={f.password} onChange={set("password")} autoComplete={mode === "in" ? "current-password" : "new-password"} />}
            {msg && <div role="alert" className={`rounded-xl border px-3.5 py-2.5 text-sm ${msg.bad ? "border-down/30 bg-down/10 text-down" : "border-up/30 bg-up/10 text-up"}`}>{msg.text}</div>}
            <Button size="lg" className="w-full" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}{{ in: "Sign in", up: "Create account", reset: "Send reset link" }[mode]}</Button>
          </form>

          <div className="mt-5 flex justify-between text-sm text-muted">
            {mode === "in" && <><button onClick={() => { setMode("reset"); setMsg(null); }} className="hover:text-fg">Forgot password?</button><button onClick={() => { setMode("up"); setMsg(null); }} className="text-brand hover:underline">Create account</button></>}
            {mode !== "in" && <button onClick={() => { setMode("in"); setMsg(null); }} className="mx-auto text-brand hover:underline">Back to sign in</button>}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
