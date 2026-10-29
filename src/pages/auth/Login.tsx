import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "./AuthLayout";
import { Field, Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Login() {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <AuthLayout title="Sign in" subtitle="Welcome back to ONE HUB.">
      <form onSubmit={submit} className="space-y-5">
        <Field label="Work email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.co.za" className="h-11" /></Field>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/reset-password" className="text-[13px] font-medium text-brand-600 hover:text-brand-700">Forgot password?</Link>
          </div>
          <div className="relative">
            <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pr-11" />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-zinc-400 transition-colors hover:text-zinc-700"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>Sign in</Button>
      </form>
      <p className="mt-8 border-t border-zinc-100 pt-6 text-center text-sm text-zinc-500">
        Don't have an account?
        <br />
        <span className="font-medium text-zinc-700">Ask an administrator to invite you.</span>
      </p>
    </AuthLayout>
  );
}
