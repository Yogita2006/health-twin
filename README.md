# Health Twin

A cloud-based prototype digital twin for personal health monitoring. Each patient gets a live 3D model of their body whose heart, lungs and whole-body status follow their vital-sign readings, compared with that patient's own baseline. Patients choose which doctors can see their twin.

**Live site:** https://health-twin-six.vercel.app
**Domain:** Healthcare

> Educational prototype. All readings are simulated or typed in by hand. It is not a medical device and does not diagnose.

## The problem

Vital signs are usually judged against population ranges at occasional visits. A value that is normal for the population can be unusual for one person, and nobody sees the change between visits. Health Twin keeps a running model of one person's vitals, compares each reading with that person's own usual range, and lets a doctor the patient has chosen see the same live state from anywhere.

## Users and roles

| Role | Can do |
| --- | --- |
| Patient | See their own twin, send readings, keep a medical history, view analytics, share or stop sharing with a doctor |
| Doctor | See the twin, history and analytics of patients who have shared with them (read only); use the cardiac advisor for those patients |
| Admin | See all accounts, change roles, open any patient's twin (read only) |

The doctor role is a demo role: no licence check is made. A doctor can read nothing until a patient shares access.

## Features

- Interactive 3D body (three.js) coloured by region status; the heart beats at the stored heart rate
- Six vital signs: heart rate, blood pressure, SpO2, temperature, respiratory rate
- Personal baseline from the patient's last 50 resting readings (median and robust spread)
- Information-only alerts after two consecutive readings outside the usual range
- Real-time updates on every open screen, with no refresh
- Medical history: conditions, medications, surgeries, allergies and events, as dated timelines
- Analytics over 7, 14 or 30 days
- Virtual wearable that simulates a device, with scenarios per organ, plus manual entry
- One-click synthetic sample data for new accounts
- Cardiac advisor for doctors: a heart disease estimate from a trained model, rule-based suggestions to accept or reject, a what-if simulation, and saved sessions (see below)

## Architecture

```
Browser (Next.js, React, three.js, Firebase client SDK)
   |  1. signs in                     |  4. live updates (onSnapshot)
   v                                  ^
Firebase Authentication            Cloud Firestore  <-- security rules on every read
   |  2. ID token (JWT)               ^
   v                                  |  3. validated writes (Admin SDK)
Vercel serverless functions (Next.js API routes)
```

1. The user signs in with Firebase Authentication and receives a signed ID token.
2. The browser sends that token with every API request.
3. A Vercel function verifies the token, validates the input with zod, runs the twin engine, and saves the reading, the new twin state, the day's summary and any alert in one Firestore transaction.
4. Firestore pushes the change to every screen that the security rules allow.

## Cloud services

| Service | Used for |
| --- | --- |
| Firebase Authentication | Email and password sign-in, confirmation email, password reset |
| Cloud Firestore | Database, real-time listeners, security rules |
| Vercel | Hosting, serverless API routes, environment secrets, deployment on every push |

Firebase Storage and Cloud Functions are not used. Both need a billing plan; the server-side work runs in Vercel functions instead.

## Cardiac advisor

A doctor-only page for patients who share with that doctor. It is an experimental decision-support and educational tool. It gives estimates, not diagnoses, and it does not prescribe.

| Step | What runs | Source |
| --- | --- | --- |
| Prediction | Logistic regression estimating heart disease on angiography | Cleveland heart disease data, 297 patients ([Kaggle](https://www.kaggle.com/datasets/cherngs/heart-disease-cleveland-uci), originally UCI). Cross-validated AUC 0.88 +/- 0.04; 50 of 60 test patients classified correctly |
| Suggestions | Fixed rules with textbook cut-offs, each shown with its reason | `src/lib/cardiac/suggestions.ts` |
| What-if simulation | The doctor sets assumed changes to the readings; a second logistic regression compares ten-year coronary heart disease risk before and after | Framingham Heart Study teaching data, 4,171 people ([Kaggle](https://www.kaggle.com/datasets/aasheesh200/framingham-heart-study-dataset)). Test AUC 0.72 |

Both models are trained by the scripts in `ml/`. The trained weights are stored as JSON in `src/lib/ml/` and applied by a serverless function, which gives the same answers as the Python models.

What the simulation is not: a prediction of how a patient responds to treatment. Neither dataset records outcomes after treatment. The assumed changes are set by the doctor, with starting values rounded from published trial averages, and the page says so next to every result.

## Security

- Every API route verifies the Firebase ID token on the server.
- The browser cannot write health data. Firestore rules deny all client writes to readings, twin state, baseline, alerts, daily summaries and medical history.
- A patient's data can be read only by that patient, a doctor in the patient's sharing list, or an admin.
- Roles are read from Firestore on the server; a request cannot claim a role.
- All input is validated on the server.
- Secrets are environment variables and are not in this repository.
- Each patient is limited to 600 readings a day.
- The cardiac advisor runs only for a doctor the patient shares with. Its saved sessions are not readable from any browser; they are reached only through the API, which repeats the check.

## Tech stack

Next.js 16, React 19, TypeScript, three.js, Recharts, zod, Firebase (Authentication, Firestore, Admin SDK), Vercel.

## Project structure

```
src/app/            pages and API routes (api/*)
src/components/     interface: twin3d, panels, history, analytics, cardiac, hud
src/hooks/          live Firestore listeners
src/lib/engine/     twin engine: baseline, status, alerts, daily summaries
src/lib/validation/ zod schemas used by the API
src/lib/ml/         trained model weights (JSON) and the code that applies them
src/lib/cardiac/    suggestion rules and the what-if simulation
ml/                 Python scripts that train the two models
firestore.rules     Firestore security rules
```

## Run locally

1. `npm install`
2. Create `.env.local` with these variables (values come from your own Firebase project):
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `FIREBASE_SERVICE_ACCOUNT_BASE64` (service account JSON, base64 encoded)
   - `ADMIN_SETUP_KEY` (a long phrase required to register an admin)
3. Publish `firestore.rules` in the Firebase Console.
4. `npm run dev` and open http://localhost:3000

## Limitations

- Readings are simulated; no real device is connected.
- Doctor accounts are not verified.
- The body model is the same for every patient; only its colours and motion change.
- The cardiac models are small and old: 297 patients from one hospital (1988) and a teaching subset of the Framingham study. They have not been validated for clinical use.
- The what-if simulation rests on assumed changes. It cannot predict a patient's response to treatment.
- Patients cannot see cardiac advisor sessions in this version.
- Free-tier quotas limit daily database writes.
- One database region; uptime has not been measured.

## Future work

Real wearable input, verified clinician accounts, a patient view of reviewed plans, file uploads for reports, automated tests.

## Credits

3D anatomy: BodyParts3D, (c) The Database Center for Life Science, licensed under CC Attribution-Share Alike 2.1 Japan. See `public/models/CREDITS.txt`.

Data for the cardiac models: Cleveland heart disease data (UCI Machine Learning Repository; Detrano et al.) and the Framingham Heart Study teaching dataset, both as published on Kaggle.