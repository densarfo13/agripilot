# AgriPilot 10-Minute Demo Script

> Read this word-for-word in a live call. Screens and clicks are marked clearly.

---

## SETUP (before the call)

- Open https://agripilot.onrender.com in Chrome
- Log in as `admin@agripilot.com` / `AgriAdmin#2026`
- Make sure the Dashboard loads with data
- Have this script open on a second screen or printed

---

## MINUTE 0-1: OPENING

**Say:**

"Thank you for taking this call. I want to show you something we've built to solve a specific problem we've seen across agricultural lending programs in East Africa.

The problem is this: when institutions like yours extend credit to smallholder farmers, the verification process is manual, slow, and vulnerable to fraud. Field officers collect paper forms. Reviewers re-enter data. GPS coordinates are taken on paper. There is no systematic way to detect when the same farm photo is submitted by two different applicants, or when two applications come from the same device.

AgriPilot solves this. It is a digital verification and decision platform for agricultural credit. Let me show you how it works."

---

## MINUTE 1-3: DASHBOARD OVERVIEW

**Screen:** You should already be on the Dashboard.

**Say:**

"This is the main dashboard. I am logged in as an institutional admin.

At the top, you can see the overall portfolio summary — total applications, approval rates, and the current decision mix.

On the left sidebar, you can see the main workflow areas: Farmers, Applications, Verification Queue, Fraud Queue, Portfolio, Reports, and Audit Trail."

**Click:** "Applications" in the sidebar.

**Say:**

"Here are all current applications. You can see each one has a status — draft, submitted, under review, approved, conditionally approved, or escalated. These statuses move automatically based on the verification and fraud analysis results.

Let me show you a strong application that was approved."

---

## MINUTE 3-5: APPROVED APPLICATION WALKTHROUGH

**Click:** Find "John Mwangi" in the applications list. Click to open.

**Say:**

"This is John Mwangi, a maize farmer in Kiambu with 5 acres and 12 years of experience. He requested 50,000 KES for hybrid seeds and fertilizer.

Scroll down and notice the key sections:"

**Scroll to GPS/Location section.**

"First, the GPS location was captured on the field officer's device with 5-meter accuracy. You can see the exact coordinates and the map."

**Scroll to Boundary section.**

"The field officer also walked the farm boundary. The system measured 4.8 acres — close to the claimed 5 acres. This kind of match builds verification confidence."

**Scroll to Evidence section.**

"Three evidence files were uploaded: a farm photo, a national ID scan, and a crop photo. Each photo is hashed. That hash is critical — I will show you why in a moment."

**Scroll to Verification Result.**

"The verification engine scored this application 88 out of 100. High confidence. You can see the factor breakdown: GPS scored 20/20, boundary 20/20, evidence 25/25. The recommendation is to approve."

**Scroll to Decision Result.**

"Based on the verification and fraud analysis, the decision engine recommended full approval for the requested 50,000 KES. No blockers."

**Pause. Let this sink in.**

"That entire flow — from GPS capture to approval recommendation — happened digitally, with audit trails on every step. No paper. No re-entry. No guesswork."

---

## MINUTE 5-7: FRAUD DETECTION

**Say:**

"Now let me show you what happens when something is wrong."

**Click:** Back to Applications list. Find "Hassan Omar". Click to open.

**Say:**

"Hassan Omar submitted a cassava application from Kilifi. On the surface, it looks normal. But watch the fraud section."

**Scroll to Fraud Result.**

"The fraud engine flagged this application with a risk score of 65 out of 100 — high risk. Three specific flags:

One — duplicate photos. The farm photo hash matches a photo uploaded by a completely different farmer, John Mwangi. Same image, different application.

Two — shared device. Hassan's application was submitted from the same physical device as another applicant, Ali Bakari.

Three — GPS proximity. Hassan's GPS coordinates are within meters of Ali Bakari's coordinates. Two supposedly different farms, same spot.

The system automatically escalated this application. No human had to catch it."

**Click:** "Fraud Queue" in the sidebar.

**Say:**

"This is the fraud queue. Reviewers see every flagged application here. They can investigate, add notes, and decide whether to reject or request a field visit."

**Click:** "Audit" in the sidebar.

**Say:**

"And every single action is recorded in the audit log. Who created the application, when the GPS was captured, when the fraud analysis ran, who escalated it. Full accountability."

---

## MINUTE 7-8: REVIEWER AND FIELD OFFICER WORKFLOW

**Say:**

"Different users see different things based on their role.

A field officer logs into the system, registers farmers, captures GPS and evidence, and submits applications.

A reviewer sees the verification queue and fraud queue. They run analysis, add notes, and make recommendations.

An institutional admin sees everything — the dashboard, portfolio, reports, and user management.

An investor or funder gets a read-only view of the portfolio and aggregate risk analytics — no access to individual farmer data."

---

## MINUTE 8-9: PORTFOLIO AND REPORTING

**Click:** "Portfolio" in the sidebar.

**Say:**

"This is the portfolio view. You can see the total applications, total amount requested, total recommended for disbursement, and the decision breakdown — how many approved, conditional, escalated, or rejected.

This is the view a program director or funder would use to track their agricultural credit portfolio in real time."

**Click:** "Reports" in the sidebar.

**Say:**

"And the reports section provides exportable data for compliance, donor reporting, or internal analysis."

---

## MINUTE 9-10: WHY IT MATTERS AND PILOT ASK

**Say:**

"Let me summarize why this matters.

Today, most agricultural credit programs rely on paper forms, manual GPS logging, and human judgment to detect fraud. The result is slow disbursement, high default rates, and limited accountability.

AgriPilot digitizes the entire verification workflow. GPS capture, boundary mapping, photo evidence with hash-based fraud detection, automated verification scoring, and a complete audit trail.

It works on any Android phone in the field. It works on desktop for reviewers and administrators. It supports multiple countries, currencies, and languages.

We are not claiming to replace human judgment. We are giving your team better data to make faster, safer decisions.

What I am asking for is a pilot. A small group of field officers — five to ten — using AgriPilot for one lending cycle. We would set up accounts, train your team in one session, and support you through the cycle.

The goal is simple: show you the difference between paper-based verification and digital verification on real applications in your program.

Can we set up a pilot?"

---

## AFTER THE DEMO

- Offer to create accounts for their team on the spot
- Share the live URL: https://agripilot.onrender.com
- Share the APK if they want to try on Android
- Follow up with the one-pager within 24 hours
