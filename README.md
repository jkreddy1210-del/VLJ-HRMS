# VLJ HRMS — Employee Management System

Premium AI-style Employee Management System built with Next.js (JavaScript).

## Tech Stack

- **Frontend:** Next.js 14, JavaScript, Tailwind CSS, ShadCN UI
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Charts:** Recharts
- **Theme:** Dark/Light mode with next-themes

## Phase 1 — Frontend UI (Current)

All screens built with mock JSON data. No backend or database connected.

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Split-screen auth with Employee Code + Password |
| Forgot Password | `/forgot-password` | Reset link with success screen |
| Dashboard | `/dashboard` | Widgets, charts, activities, quick actions |
| Employee List | `/employees` | Search, filters, data table |
| Add Employee | `/employees/add` | Multi-section form |
| Employee Profile | `/employees/[id]` | Tabs: Overview, Attendance, Leaves, Documents, Activity |
| Daily Attendance | `/attendance` | Checkbox-based attendance marking |
| Attendance Monitor | `/attendance/monitoring` | Real-time cards and filters |
| Leave Management | `/leaves` | Balances, requests, calendar, apply leave |
| Reports | `/reports` | Printable monthly attendance register |
| Roles & Permissions | `/roles` | RBAC overview |

### Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Demo Login:** Use any Employee Code and Password

### Attendance Register

Navigate to Reports → Select Department, Month, Year → Generate Report

- Monday–Saturday only (Sundays excluded)
- Two dates per A4 page
- In Time, Out Time, Signature columns for manual entry
- Print-friendly layout

## Phase 2 — Backend (Future)

- Express.js REST APIs
- MySQL + Prisma ORM
- JWT Authentication
- CamAttendance Integration
- Database setup after `.env` credentials are added
