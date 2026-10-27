import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { AuthLayout } from "./AuthLayout";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Login() {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn("password", { email: email.trim().toLowerCase(), password, flow: "signIn" });
    } catch {
      setError("Incorrect email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Sign in to ONE HUB" subtitle="Use your personal ONE HUB account.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Work email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.co.za" /></Field>
        <Field label="Password"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>Sign in</Button>
      </form>
      <div className="mt-6 flex items-center justify-between text-sm">
        <Link to="/reset-password" className="font-medium text-brand-600 hover:text-brand-700">Forgot password?</Link>
        <span className="text-zinc-400">Invite only</span>
      </div>
    </AuthLayout>
  );
}
