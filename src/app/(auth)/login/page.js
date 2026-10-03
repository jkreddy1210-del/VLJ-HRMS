"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import Link from "next/link";

import { motion } from "framer-motion";

import { Eye, EyeOff } from "lucide-react";

import { AuthHeroPanel } from "@/components/auth/auth-hero-panel";

import { AuthFormPanel } from "@/components/auth/auth-form-panel";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Checkbox } from "@/components/ui/checkbox";

import { useAuth } from "@/context/auth-context";
import { isValidEmail, AUTH_MESSAGES } from "@/lib/auth-validation";



export default function LoginPage() {

  const router = useRouter();

  const { login, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [rememberMe, setRememberMe] = useState(false);

  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [loading, setLoading] = useState(false);



  const handleSubmit = async (e) => {

    e.preventDefault();

    setError("");
    setFieldError("");
    setLoading(true);

    if (!email || !password) {
      setError(AUTH_MESSAGES.emailAndPasswordRequired);
      setLoading(false);
      return;
    }

    if (!isValidEmail(email)) {
      setFieldError("email");
      setError(AUTH_MESSAGES.emailRequired);
      setLoading(false);
      return;
    }

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      if (err.field === "password") {
        setFieldError("password");
      } else if (err.field === "email") {
        setFieldError("email");
      }
      setError(err.message || AUTH_MESSAGES.passwordRequired);
    }

    setLoading(false);

  };



  return (

    <div className="flex min-h-screen flex-col lg:flex-row">

      <AuthHeroPanel />



      <AuthFormPanel>

        <h2 className="mb-2 font-display text-2xl font-bold">Welcome back</h2>

        <p className="mb-8 text-muted-foreground">Sign in to your employee account</p>



        <form onSubmit={handleSubmit} className="space-y-5 [&_label]:text-center lg:[&_label]:text-left">

          <div className="space-y-2">

            <Label htmlFor="email">Email</Label>

            <Input

              id="email"

              type="email"

              placeholder="your.email@company.com"

              value={email}

              onChange={(e) => { setEmail(e.target.value); setFieldError(""); setError(""); }}

              className={`h-12 text-center lg:text-left ${fieldError === "email" ? "border-destructive" : ""}`}

            />

          </div>



          <div className="space-y-2">

            <Label htmlFor="password">Password</Label>

            <div className="relative">

              <Input

                id="password"

                type={showPassword ? "text" : "password"}

                placeholder="Enter your password"

                value={password}

                onChange={(e) => { setPassword(e.target.value); setFieldError(""); setError(""); }}

                className={`h-12 pr-10 text-center lg:text-left ${fieldError === "password" ? "border-destructive" : ""}`}

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



          <div className="flex flex-col items-center gap-3 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-center justify-center gap-2 lg:justify-start">

              <Checkbox

                id="remember"

                checked={rememberMe}

                onCheckedChange={setRememberMe}

              />

              <Label htmlFor="remember" className="cursor-pointer text-sm font-normal">

                Remember Me

              </Label>

            </div>

            <Link href="/forgot-password" className="text-sm text-champagne hover:underline">

              Forgot Password?

            </Link>

          </div>



          {error && (

            <motion.p

              initial={{ opacity: 0 }}

              animate={{ opacity: 1 }}

              className="text-sm text-destructive"

            >

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

              "Sign In"

            )}

          </Button>

        </form>

      </AuthFormPanel>

    </div>

  );

}


