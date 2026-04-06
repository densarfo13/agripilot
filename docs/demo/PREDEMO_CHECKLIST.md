# AgriPilot Pre-Demo Checklist

> Run this 5 minutes before any live demo or pilot meeting.

---

## 1. Server Health

- [ ] Open https://agripilot.onrender.com/api/health
- [ ] Confirm response shows `"status":"ok"`
- [ ] If the page takes 30+ seconds to load, it is cold-starting — wait for it

---

## 2. Admin Login

- [ ] Open https://agripilot.onrender.com/login
- [ ] Log in with `admin@agripilot.com` / `AgriAdmin#2026`
- [ ] Confirm Dashboard loads with data (not empty)
- [ ] Confirm sidebar shows: Dashboard, Farmers, Applications, Verification Queue, Fraud Queue, Portfolio, Reports, Audit, Control Center, User Management

---

## 3. Demo Data Present

- [ ] Click "Applications" — confirm at least 8 applications are listed
- [ ] Confirm statuses visible: approved, conditional, escalated, under review, draft
- [ ] Click "John Mwangi" application — confirm it opens
- [ ] Scroll down — confirm GPS location, boundary, evidence, verification, and decision sections all load

---

## 4. Fraud Case Ready

- [ ] Go back to Applications
- [ ] Click "Hassan Omar" application
- [ ] Confirm fraud section shows: duplicate_photos, shared_device, gps_proximity flags
- [ ] Confirm status is "escalated"

---

## 5. Verification Queue

- [ ] Click "Verification Queue" in sidebar
- [ ] Confirm at least 2-3 applications appear in queue

---

## 6. Fraud Queue

- [ ] Click "Fraud Queue" in sidebar
- [ ] Confirm at least 1 high-risk application appears

---

## 7. Audit Trail

- [ ] Click "Audit" in sidebar
- [ ] Confirm audit log shows entries with actions, users, and timestamps
- [ ] Confirm at least 10+ entries visible

---

## 8. Portfolio

- [ ] Click "Portfolio" in sidebar
- [ ] Confirm portfolio summary loads with total applications, amounts, and decision mix

---

## 9. Reports

- [ ] Click "Reports" in sidebar
- [ ] Confirm page loads without errors

---

## 10. Reviewer Login (optional)

- [ ] Open a private/incognito window
- [ ] Log in as `reviewer@agripilot.com` / `AgriStaff#2026`
- [ ] Confirm dashboard loads
- [ ] Confirm Verification Queue and Fraud Queue are accessible

---

## 11. No Insecure Defaults

- [ ] Confirm `password123` does NOT work for `admin@agripilot.com`
- [ ] If it does, reseed the database: `cd server && node prisma/seed.js`

---

## 12. Android APK (if demoing mobile)

- [ ] Open AgriPilot app on phone
- [ ] Confirm login works with demo credentials
- [ ] Confirm app shows correct AgriPilot logo (leaf + checkmark)

---

## If Something Is Broken

**Data missing or corrupted:**
```bash
cd server && node prisma/seed.js
```

**Server not responding:**
- Check Render dashboard: https://dashboard.render.com
- Click on the agripilot service
- Check deploy logs for errors
- If needed, click "Manual Deploy" > "Deploy latest commit"

**Login fails:**
- Reseed the database (above command)
- Or use admin UI to reset passwords

---

## Quick Reference

| Account | Email | Password |
|---------|-------|----------|
| Admin | admin@agripilot.com | AgriAdmin#2026 |
| Reviewer | reviewer@agripilot.com | AgriStaff#2026 |
| Field Officer | officer@agripilot.com | AgriStaff#2026 |
| Investor | investor@agripilot.com | AgriView#2026 |
