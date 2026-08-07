import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Btn from "../components/Btn.jsx";
import Waveform from "../components/Waveform.jsx";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in both fields.");
      return;
    }
    // Placeholder auth — navigate to dashboard
    navigate("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-paper text-ink font-body px-5">
      {/* Background waveform */}
      <div className="absolute inset-x-0 top-1/3 pointer-events-none opacity-[0.04]">
        <Waveform mode="hero" barCount={80} />
      </div>

      <div className="relative w-full max-w-sm">
        <Link to="/" className="block font-display text-2xl font-bold tracking-tight text-ink text-center mb-8 hover:text-ember transition-colors">
          DABAR
        </Link>

        <h1 className="font-display text-xl font-semibold text-center mb-6">
          Sign in to your account
        </h1>

        {error && (
          <div className="mb-4 rounded-card border border-ember/30 bg-ember/5 px-4 py-3 text-sm text-ember">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-ink mb-1 block">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@church.org"
              className="w-full rounded-card border border-border bg-paper px-4 py-2.5 text-sm text-ink placeholder:text-muted/60 outline-none transition-colors focus:border-ember"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink mb-1 block">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="w-full rounded-card border border-border bg-paper px-4 py-2.5 text-sm text-ink placeholder:text-muted/60 outline-none transition-colors focus:border-ember"
            />
          </label>

          <Btn type="submit" className="w-full mt-2" size="md">
            Sign in
          </Btn>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Don't have an account?{" "}
          <Link to="/signup" className="font-medium text-ember hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
