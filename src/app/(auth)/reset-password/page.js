"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, CheckCircle2, ArrowLeft } from "lucide-react";
import { AuthHeroPanel } from "@/components/auth/auth-hero-panel";
import { AuthFormPanel } from "@/components/auth/auth-form-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword({ token, password });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err) {
      setError(err.message || "Reset failed");
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <div className="text-center">
        <p className="mb-4 text-destructive">Invalid reset link</p>
        <Link href="/forgot-password">
          <Button variant="premium" className="h-12 w-full text-base">Request New Link</Button>
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
        <h2 className="mb-2 font-display text-2xl font-bold">Password Updated</h2>
        <p className="text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex justify-center lg:justify-start">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Login
        </Link>
      </div>

      <h2 className="mb-2 font-display text-2xl font-bold">Create New Password</h2>
      <p className="mb-8 text-muted-foreground">Enter your new password below.</p>

      <form onSubmit={handleSubmit} className="space-y-5 [&_label]:text-center lg:[&_label]:text-left">
        <div className="space-y-2">
          <Label>New Password</Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 pr-10 text-center lg:text-left"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Confirm Password</Label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-12 text-center lg:text-left"
            required
          />
        </div>
        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-destructive">
            {error}
          </motion.p>
        )}
        <Button type="submit" variant="premium" className="h-12 w-full text-base" disabled={loading}>
          {loading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="h-5 w-5 rounded-full border-2 border-white border-t-transparent"
            />
          ) : (
            "Update Password"
          )}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AuthHeroPanel />

      <AuthFormPanel>
        <Suspense fallback={<div className="text-center text-muted-foreground">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </AuthFormPanel>
    </div>
  );
}
