"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { AuthHeroPanel } from "@/components/auth/auth-hero-panel";
import { AuthFormPanel } from "@/components/auth/auth-form-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { isValidEmail, AUTH_MESSAGES } from "@/lib/auth-validation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError(AUTH_MESSAGES.emailRequired);
      return;
    }

    if (!isValidEmail(email)) {
      setError(AUTH_MESSAGES.emailRequired);
      return;
    }

    setLoading(true);
    try {
      await api.forgotPassword({ email: email.trim().toLowerCase() });
      setSuccess(true);
    } catch (err) {
      if (err.field === "email") {
        setError(err.message || AUTH_MESSAGES.emailRequired);
      } else {
        setError(err.message || "Request failed");
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AuthHeroPanel />

      <AuthFormPanel>
        <AnimatePresence mode="wait">
          {!success ? (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-6 flex justify-center lg:justify-start">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Login
                </Link>
              </div>

              <h2 className="mb-2 font-display text-2xl font-bold">Forgot Password?</h2>
              <p className="mb-8 text-muted-foreground">
                Enter your registered email. We&apos;ll send a secure reset link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5 [&_label]:text-center lg:[&_label]:text-left">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="youremail@gmail.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      className={`h-12 pl-9 ${error ? "border-destructive" : ""}`}
                      required
                    />
                  </div>
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
                    "Send Reset Link"
                  )}
                </Button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10"
              >
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </motion.div>

              <h2 className="mb-2 font-display text-2xl font-bold">Check Your Email</h2>
              <p className="mb-2 text-muted-foreground">We&apos;ve sent a secure password reset link to</p>
              <p className="mb-6 font-medium text-champagne">{email}</p>
              <p className="mb-6 text-sm text-muted-foreground">
                The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
              </p>

              <div className="flex flex-col gap-3">
                <Button
                  variant="outline"
                  className="h-12"
                  onClick={() => {
                    setSuccess(false);
                    setEmail("");
                  }}
                >
                  Try Another Email
                </Button>
                <Link href="/login">
                  <Button variant="premium" className="h-12 w-full text-base">
                    Back to Login
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </AuthFormPanel>
    </div>
  );
}
