"use client";



import Link from "next/link";

import { usePathname } from "next/navigation";

import { motion } from "framer-motion";

import {

  LayoutDashboard,

  Users,

  UserPlus,

  CalendarCheck,

  CalendarDays,

  FileBarChart,

  Shield,

  Building2,

  Clock,

  ChevronLeft,

  ChevronRight,

  X,

} from "lucide-react";

import { cn } from "@/lib/utils";

import { BrandMark } from "@/components/brand/brand-mark";

import { Button } from "@/components/ui/button";

import { useAuth } from "@/context/auth-context";



const navItems = [

  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },

  { href: "/employees", label: "Employees", icon: Users, perm: ["Employee Management", "User Management"] },

  { href: "/employees/add", label: "Add Employee", icon: UserPlus, perm: ["Employee Management"] },

  { href: "/organization", label: "Departments & Designations", icon: Building2, perm: ["Department Management", "Employee Management"] },

  { href: "/shifts", label: "Shift Management", icon: Clock, perm: ["Shift Management", "Department Management"] },

  { href: "/attendance", label: "Daily Attendance", icon: CalendarCheck, perm: ["View Attendance", "Mark Attendance", "Attendance Monitoring", "View Team Attendance"] },

  { href: "/leaves", label: "Leave Management", icon: CalendarDays, perm: ["Apply Leave", "View Leave Requests", "View Team Leave Requests", "Final Leave Approval", "Leave Approval"] },

  { href: "/reports", label: "Reports", icon: FileBarChart, perm: ["Generate Reports", "View Team Reports"] },

  { href: "/reports/attendance", label: "Attendance Report", icon: FileBarChart, perm: ["Generate Reports", "View Team Reports"] },

  { href: "/roles", label: "Roles & Permissions", icon: Shield, roles: ["admin", "super_admin"] },

];



function canAccessNavItem(item, user) {

  if (!user) return item.href === "/dashboard";

  const perms = user.permissions || [];

  const full = perms.includes("Full System Access") || perms.includes("All Permissions");



  if (item.roles) return item.roles.includes(user.role);

  if (full) return true;

  if (!item.perm) return true;

  return item.perm.some((p) => perms.includes(p));

}



export function Sidebar({ collapsed, onToggle, mobile = false, onClose }) {

  const pathname = usePathname();

  const { user } = useAuth();



  const handleNavClick = () => {

    if (mobile && onClose) onClose();

  };



  const asideClassName = cn(

    "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-champagne/10 bg-espresso text-white",

    mobile && "w-[min(280px,85vw)] shadow-2xl"

  );



  const navContent = (

    <>

      <div className="flex h-16 items-center border-b border-white/10 px-3">

        {collapsed && !mobile ? (

          <BrandMark variant="icon" size="sm" className="mx-auto" />

        ) : (

          <motion.div

            initial={{ opacity: 0 }}

            animate={{ opacity: 1 }}

            exit={{ opacity: 0 }}

            className="min-w-0 overflow-hidden"

          >

            <BrandMark variant="light" size="sm" />

          </motion.div>

        )}

      </div>



      <nav className="flex-1 space-y-1 overflow-y-auto p-3">

        {navItems.filter((item) => canAccessNavItem(item, user)).map((item) => {

          const activeCheck =
            item.href === "/employees/add"
              ? pathname === "/employees/add"
              : item.href === "/employees"
                ? pathname === "/employees" || (pathname.startsWith("/employees/") && !pathname.includes("/add"))
                : item.href === "/attendance"
                  ? pathname === "/attendance"
                  : item.href === "/reports"
                    ? pathname === "/reports"
                    : item.href === "/reports/attendance"
                      ? pathname === "/reports/attendance"
                      : item.href === "/shifts"
                        ? pathname === "/shifts"
                        : pathname === item.href;

          return (

            <Link key={item.href} href={item.href} onClick={handleNavClick}>

              <motion.div

                whileHover={{ x: 4 }}

                className={cn(

                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",

                  activeCheck

                    ? "bg-champagne/20 text-white shadow-glow"

                    : "text-white/60 hover:bg-white/5 hover:text-white"

                )}

              >

                <item.icon className={cn("h-5 w-5 shrink-0", activeCheck && "text-champagne-light")} />

                {(!collapsed || mobile) && <span>{item.label}</span>}

              </motion.div>

            </Link>

          );

        })}

      </nav>



      <div className="border-t border-white/10 p-3">

        {mobile ? (

          <Button

            variant="ghost"

            onClick={onClose}

            className="w-full justify-start gap-2 text-white/60 hover:bg-white/5 hover:text-white"

          >

            <X className="h-5 w-5" />

            Close Menu

          </Button>

        ) : (

          <Button

            variant="ghost"

            size="icon"

            onClick={onToggle}

            className="w-full text-white/60 hover:bg-white/5 hover:text-white"

          >

            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}

          </Button>

        )}

      </div>

    </>

  );



  if (mobile) {

    return (

      <motion.aside

        initial={{ x: "-100%" }}

        animate={{ x: 0 }}

        exit={{ x: "-100%" }}

        transition={{ duration: 0.25, ease: "easeOut" }}

        className={asideClassName}

      >

        {navContent}

      </motion.aside>

    );

  }



  return (

    <motion.aside

      initial={false}

      animate={{ width: collapsed ? 72 : 260 }}

      transition={{ duration: 0.3, ease: "easeInOut" }}

      className={asideClassName}

    >

      {navContent}

    </motion.aside>

  );

}


