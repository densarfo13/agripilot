# Farroway Demo Accounts

> These accounts are pre-seeded with realistic data. Change passwords before any production use.

## Live URL

**https://agripilot-production.up.railway.app**

---

## Admin Accounts

| Role | Name | Email | Password |
|------|------|-------|----------|
| Super Admin | Sarah Okonkwo | `admin@farroway.com` | `AgriAdmin#2026` |
| Institutional Admin | James Mutua | `institution@farroway.com` | `AgriAdmin#2026` |

**Access:** Full system — dashboard, all applications, user management, audit logs, control center.

---

## Staff Accounts

| Role | Name | Email | Password |
|------|------|-------|----------|
| Reviewer | Grace Wanjiku | `reviewer@farroway.com` | `AgriStaff#2026` |
| Reviewer | Peter Ochieng | `reviewer2@farroway.com` | `AgriStaff#2026` |
| Field Officer (Kenya) | David Kamau | `officer@farroway.com` | `AgriStaff#2026` |
| Field Officer (Kenya) | Mary Achieng | `officer2@farroway.com` | `AgriStaff#2026` |
| Field Officer (Tanzania) | Joseph Mwalimu | `officer.tz@farroway.com` | `AgriStaff#2026` |

**Access:** Farmer registration, applications, verification queue, fraud queue.

---

## Viewer Account

| Role | Name | Email | Password |
|------|------|-------|----------|
| Investor/Funder | Robert Chen | `investor@farroway.com` | `AgriView#2026` |

**Access:** Portfolio dashboard, reports (read-only).

---

## Demo Farmers (pre-registered in system)

| Name | Region | Crop | Farm Size | Status |
|------|--------|------|-----------|--------|
| John Mwangi | Kiambu, Kenya | Maize | 5 acres | **Approved** (score: 88) |
| Amina Hassan | Uasin Gishu, Kenya | Wheat | 15 acres | **Conditional** (score: 68) |
| Peter Otieno | Bungoma, Kenya | Sugarcane | 8 acres | **Approved** (score: 85) |
| Florence Nyambura | Murang'a, Kenya | Coffee | 3 acres | Draft |
| Hassan Omar | Kilifi, Kenya | Cassava | 4 acres | **Escalated** (fraud) |
| Ali Bakari | Kilifi, Kenya | Cassava | 3.5 acres | Under Review (fraud link) |
| Elizabeth Wambui | Nyeri, Kenya | Tea | 2 acres | Draft |
| Samuel Kipchoge | Nandi, Kenya | Maize | 20 acres | Under Review |

---

## Recommended Demo Path

1. **Log in as:** `admin@farroway.com` / `AgriAdmin#2026`
2. **Show dashboard** — overview of all applications and portfolio
3. **Click "John Mwangi"** — approved application with full evidence, GPS, boundary, verification, decision
4. **Click "Hassan Omar"** — fraud escalation case with duplicate photos and shared device
5. **Switch to reviewer:** `reviewer@farroway.com` / `AgriStaff#2026` — show verification queue
6. **Show audit log** — complete trail of every action
7. **Show portfolio** — aggregate risk and decision analytics

---

## Reseed Command

To reset all demo data to defaults:

```bash
cd server && node prisma/seed.js
```

This clears all existing data and recreates the full demo dataset.
