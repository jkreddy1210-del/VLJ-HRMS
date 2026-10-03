"use client";

import { motion } from "framer-motion";
import { Sparkles, Shield, Users, BarChart3 } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";

export function AuthHeroPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6 }}
      className="relative hidden overflow-hidden premium-gradient lg:flex lg:w-1/2"
    >
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
      <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <BrandMark variant="hero" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-4 text-4xl font-bold leading-tight text-white xl:text-5xl"
        >
          Manage Your Workforce
          <span className="block text-champagne-light">Intelligently</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-10 max-w-md text-lg text-white/70"
        >
          AI-powered HRMS platform for attendance tracking, leave management, and employee lifecycle management.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-3 gap-4"
        >
          {[
            { icon: Users, label: "248+ Employees" },
            { icon: BarChart3, label: "Real-time Analytics" },
            { icon: Shield, label: "Enterprise Security" },
          ].map((item, i) => (
            <div key={i} className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
              <item.icon className="mb-2 h-5 w-5 text-champagne-light" />
              <p className="text-xs text-white/80">{item.label}</p>
            </div>
          ))}
        </motion.div>

        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute bottom-20 right-20 opacity-20"
        >
          <Sparkles className="h-32 w-32 text-white" />
        </motion.div>
      </div>
    </motion.div>
  );
}
