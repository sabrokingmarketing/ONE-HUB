import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";
import { AuthLayout } from "./AuthLayout";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/utils";

export default function ResetPassword() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn("password", { flow: "reset", email: email.trim().toLowerCase() });
    } catch {
      /* Never reveal whether an account exists. */
    } finally {
      setLoading(false);
      setStep("verify");
    }
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn("password", { flow: "reset-verification", email: email.trim().toLowerCase(), code: code.trim(), newPassword: password });
      toast.success("Password updated");
      navigate("/");
    } catch (err) {
      setError(errorMessage(err).includes("Password") ? errorMessage(err) : "That code is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle={step === "request" ? "We'll email you an 8-digit code." : `If an account exists for ${email}, a code is on its way.`}>
      {step === "request" ? (
        <form onSubmit={request} className="space-y-4">
          <Field label="Work email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>Send code</Button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <Field label="8-digit code"><Input inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} /></Field>
          <Field label="New password" hint="At least 10 characters with letters and numbers."><Input type="password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></Field>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>Update password</Button>
        </form>
      )}
      <Link to="/login" className="mt-6 inline-block text-sm font-medium text-brand-600">Back to sign in</Link>
    </AuthLayout>
  );
}
