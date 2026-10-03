"use client";

import { motion } from "framer-motion";
import { BrandMark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";

const MOBILE_PATTERN =
  "bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')]";

export function AuthFormPanel({ children, className }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6 }}
      className={cn(
        "relative flex min-h-screen w-full items-center justify-center overflow-hidden px-5 py-8 sm:px-6",
        "max-lg:premium-gradient lg:min-h-0 lg:w-1/2 lg:bg-background lg:py-6"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-50 max-lg:block lg:hidden",
          MOBILE_PATTERN
        )}
        aria-hidden
      />

      <div className={cn("relative z-10 w-full max-w-[22rem] sm:max-w-md", className)}>
        <div className="mb-6 flex justify-center lg:hidden">
          <BrandMark variant="hero-mobile" onDark />
        </div>

        <div
          className={cn(
            "max-lg:rounded-2xl max-lg:border max-lg:border-white/25 max-lg:bg-white/95 max-lg:p-6 max-lg:shadow-[0_20px_50px_rgba(44,36,25,0.35)] max-lg:backdrop-blur-md",
            "lg:p-0 lg:shadow-none"
          )}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center lg:text-left"
          >
            {children}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
