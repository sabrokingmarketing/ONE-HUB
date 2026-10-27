import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";
import { AuthLayout } from "./AuthLayout";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "../../../convex/lib/permissionMatrix";
import { errorMessage } from "@/lib/utils";

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const bootstrap = params.get("bootstrap") === "1";
  const invite = useQuery(api.users.getInvitation, token ? { token } : "skip");
  const { signIn } = useAuthActions();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    try {
      await signIn("password", {
        flow: "signUp",
        email: (invite?.email ?? email).trim().toLowerCase(),
        password,
        name: name.trim() || invite?.name || "",
        ...(token ? { inviteToken: token } : {}),
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!token && !bootstrap) {
    return (
      <AuthLayout title="Invitation required" subtitle="ONE HUB accounts are created by invitation only.">
        <p className="text-sm text-zinc-600">Open the link in your invitation email, or ask an administrator to invite you.</p>
        <Link to="/login" className="mt-6 inline-block text-sm font-medium text-brand-600">Back to sign in</Link>
      </AuthLayout>
    );
  }
  if (token && invite === undefined) return <AuthLayout title="Checking your invitation…"><div className="h-24 animate-pulse rounded-xl bg-zinc-200/60" /></AuthLayout>;
  if (token && (!invite || !invite.valid)) {
    return (
      <AuthLayout title="This invitation can't be used" subtitle="It may have expired, been revoked or already been accepted.">
        <p className="text-sm text-zinc-600">Ask a ONE HUB administrator to resend your invitation.</p>
        <Link to="/login" className="mt-6 inline-block text-sm font-medium text-brand-600">Back to sign in</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={invite ? `Welcome, ${invite.name.split(" ")[0]}` : "Create the first administrator"}
      subtitle={invite ? <>Activate your account to join ONE HUB as <Badge tone="brand">{ROLE_LABELS[invite.role]}</Badge></> : "Only the configured bootstrap admin email can complete this step."}
    >
      <form onSubmit={submit} className="space-y-4">
        {invite ? (
          <Field label="Email"><Input value={invite.email} disabled /></Field>
        ) : (
          <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        )}
        <Field label="Full name"><Input required value={name || invite?.name || ""} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
        <Field label="Create password" hint="At least 10 characters with letters and numbers."><Input type="password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></Field>
        <Field label="Confirm password"><Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></Field>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>Activate account</Button>
      </form>
    </AuthLayout>
  );
}
