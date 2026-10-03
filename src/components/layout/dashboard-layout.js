"use client";



import { useState, useEffect } from "react";

import { useRouter } from "next/navigation";

import { motion, AnimatePresence } from "framer-motion";

import { Sidebar } from "./sidebar";

import { Header } from "./header";

import { useAuth } from "@/context/auth-context";

import { cn } from "@/lib/utils";



export function DashboardLayout({ children }) {

  const { isAuthenticated, isLoading } = useAuth();

  const router = useRouter();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [mobileOpen, setMobileOpen] = useState(false);



  useEffect(() => {

    if (!isLoading && !isAuthenticated) {

      router.push("/login");

    }

  }, [isAuthenticated, isLoading, router]);



  useEffect(() => {

    if (!mobileOpen) return;

    const prev = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {

      if (e.key === "Escape") setMobileOpen(false);

    };

    window.addEventListener("keydown", onKeyDown);

    return () => {

      document.body.style.overflow = prev;

      window.removeEventListener("keydown", onKeyDown);

    };

  }, [mobileOpen]);



  if (isLoading) {

    return (

      <div className="flex h-screen items-center justify-center bg-background">

        <motion.div

          animate={{ rotate: 360 }}

          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}

          className="h-10 w-10 rounded-full border-4 border-champagne border-t-transparent"

        />

      </div>

    );

  }



  if (!isAuthenticated) return null;



  return (

    <div className="min-h-screen bg-background">

      <div className="hidden lg:block">

        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      </div>



      <AnimatePresence>

        {mobileOpen && (

          <div className="fixed inset-0 z-50 lg:hidden">

            <motion.div

              initial={{ opacity: 0 }}

              animate={{ opacity: 1 }}

              exit={{ opacity: 0 }}

              className="absolute inset-0 bg-black/50"

              onClick={() => setMobileOpen(false)}

            />

            <Sidebar mobile collapsed={false} onClose={() => setMobileOpen(false)} />

          </div>

        )}

      </AnimatePresence>



      <main

        className={cn(

          "min-h-screen min-w-0 transition-all max-lg:ml-0",

          sidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"

        )}

      >

        <Header onMenuToggle={() => setMobileOpen(true)} />

        <div className="p-4 sm:p-5 lg:p-6">{children}</div>

      </main>

    </div>

  );

}


