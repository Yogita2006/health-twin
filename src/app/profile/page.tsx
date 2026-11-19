"use client";

// Profile. A patient edits their personal details and chooses which doctors
// can see their twin. A doctor sees the code they give to patients.
import { useEffect, useState, FormEvent } from "react";
import { updateProfile, User } from "firebase/auth";
import { useRequireRole } from "@/lib/auth/useRequireRole";
import { usePatientRecord } from "@/hooks/usePatients";
import { HudLoading, HudPanel, HudShell } from "@/components/hud/Hud";
import { ApiResult, apiError, callApi } from "@/lib/api/client";
import { BLOOD_GROUPS, PatientRecord, SEXES, SEX_LABEL, Sex, bmiFrom } from "@/lib/patient";

// ---------- Name only (doctors and admins) ----------
function NameForm({ user, initialName }: { user: User; initialName: string }) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const result = await callApi(user, "PUT", "/api/profile", { displayName: name });
    if (result.ok) {
      await updateProfile(user, { displayName: name.trim() }).catch(() => {});
      setNotice("Saved.");
    } else setError(apiError(result));
    setBusy(false);
  }

  return (
    <form onSubmit={save}>
      <label className="hud-field" style={{ marginTop: 0 }}>
        <span className="hud-label">Full name</span>
        <input className="hud-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
      </label>
      {error && <p className="hud-error">{error}</p>}
      {notice && <p className="hud-success">{notice}</p>}
      <div className="hud-actions">
        <button type="submit" disabled={busy} className="hud-btn hud-btn-solid hud-btn-large">
          {busy ? "Saving" : "Save"}
        </button>
      </div>
    </form>
  );
}

// ---------- Personal details (patients) ----------
function PatientForm({ user, record }: { user: User; record: PatientRecord }) {
  const [name, setName] = useState(record.displayName ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(record.profile?.dateOfBirth ?? "");
  const [sex, setSex] = useState<Sex>(record.profile?.sex ?? "undisclosed");
  const [height, setHeight] = useState(record.profile?.heightCm ? String(record.profile.heightCm) : "");
  const [weight, setWeight] = useState(record.profile?.weightKg ? String(record.profile.weightKg) : "");
  const [bloodGroup, setBloodGroup] = useState(record.profile?.bloodGroup ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const heightCm = height === "" ? null : Number(height);
  const weightKg = weight === "" ? null : Number(weight);
  const bmi = bmiFrom({ dateOfBirth, sex, heightCm, weightKg, bloodGroup });

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const result = await callApi(user, "PUT", "/api/profile", { displayName: name, dateOfBirth, sex, heightCm, weightKg, bloodGroup });
    if (result.ok) {
      await updateProfile(user, { displayName: name.trim() }).catch(() => {});
      setNotice("Profile saved.");
    } else setError(apiError(result));
    setBusy(false);
  }

  return (
    <form onSubmit={save}>
      <div className="hud-form-grid">
        <label className="hud-field">
          <span className="hud-label">Full name</span>
          <input className="hud-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        </label>
        <label className="hud-field">
          <span className="hud-label">Date of birth</span>
          <input className="hud-input" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} min="1900-01-01" />
        </label>
        <label className="hud-field">
          <span className="hud-label">Sex</span>
          <select className="hud-input" value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            {SEXES.map((s) => (
              <option key={s} value={s}>
                {SEX_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="hud-field">
          <span className="hud-label">Blood group</span>
          <select className="hud-input" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
            <option value="">Not given</option>
            {BLOOD_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="hud-field">
          <span className="hud-label">Height (cm)</span>
          <input className="hud-input" type="number" inputMode="decimal" min={30} max={250} step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} />
        </label>
        <label className="hud-field">
          <span className="hud-label">Weight (kg)</span>
          <input className="hud-input" type="number" inputMode="decimal" min={1} max={400} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
      </div>

      <p className="hud-label hud-note">{bmi ? `Body mass index from these figures: ${bmi.toFixed(1)}` : "Enter height and weight to see body mass index"}</p>

      {error && <p className="hud-error">{error}</p>}
      {notice && <p className="hud-success">{notice}</p>}

      <div className="hud-actions">
        <button type="submit" disabled={busy} className="hud-btn hud-btn-solid hud-btn-large">
          {busy ? "Saving" : "Save profile"}
        </button>
      </div>
      <p className="hud-label hud-note">Educational prototype / Enter made-up details only</p>
    </form>
  );
}

// ---------- Doctors the patient shares with ----------
type Doctor = { id: string; name: string };

function CareTeam({ user, record }: { user: User; record: PatientRecord }) {
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const team = Object.entries(record.careTeam ?? {}).sort((a, b) => a[1].since - b[1].since);

  // Fetch the list of doctors once, when this panel opens.
  useEffect(() => {
    let cancelled = false;
    callApi(user, "POST", "/api/doctors").then((result) => {
      if (cancelled) return;
      if (result.ok) setDoctors((result as ApiResult & { doctors?: Doctor[] }).doctors ?? []);
      else {
        setDoctors([]);
        setError(apiError(result));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function run(method: "POST" | "DELETE", doctorId: string) {
    setBusy(true);
    setError("");
    setNotice("");
    const result = await callApi(user, method, "/api/care-team", { doctorId });
    if (result.ok) setNotice(result.message ?? "Done.");
    else setError(apiError(result));
    setBusy(false);
  }

  const wanted = search.trim().toLowerCase();
  const available = (doctors ?? []).filter((d) => !record.assignedDoctorIds.includes(d.id) && d.name.toLowerCase().includes(wanted));

  return (
    <div>
      <span className="hud-label">Sharing with</span>
      <div className="hud-note">
        {team.length === 0 ? (
          <p className="hud-text hud-plain">Nobody. Only you can see your twin.</p>
        ) : (
          team.map(([doctorId, member]) => (
            <div key={doctorId} className="hud-item">
              <div className="hud-item-main">
                <p className="hud-item-name">{member.name}</p>
                <span className="hud-label">Sharing since {new Date(member.since).toLocaleDateString()}</span>
              </div>
              <button onClick={() => run("DELETE", doctorId)} disabled={busy} className="hud-btn hud-btn-danger">
                Stop sharing
              </button>
            </div>
          ))
        )}
      </div>

      {error && <p className="hud-error">{error}</p>}
      {notice && <p className="hud-success">{notice}</p>}

      <label className="hud-field">
        <span className="hud-label">Choose a doctor to share with</span>
        <input className="hud-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search doctors by name" />
      </label>
      <div className="hud-scroll">
        {doctors === null && <p className="hud-empty">Loading doctors...</p>}
        {doctors !== null && available.length === 0 && (
          <p className="hud-text hud-plain">{doctors.length === 0 ? "No doctors have registered yet." : wanted ? "No doctor matches that name." : "You are already sharing with every registered doctor."}</p>
        )}
        {available.map((doctor) => (
          <div key={doctor.id} className="hud-item">
            <div className="hud-item-main">
              <p className="hud-item-name">{doctor.name}</p>
              <span className="hud-label">Doctor</span>
            </div>
            <button onClick={() => run("POST", doctor.id)} disabled={busy} className="hud-btn">
              Share my twin
            </button>
          </div>
        ))}
      </div>

      <p className="hud-label hud-note">A doctor can see your twin only while they are on your sharing list / You can stop sharing at any time</p>
    </div>
  );
}

export default function ProfilePage() {
  const { user, role, name, ready } = useRequireRole(["patient", "doctor", "admin"]);
  const isPatient = role === "patient";
  const { record, ready: recordReady } = usePatientRecord(ready && isPatient && user ? user.uid : null);

  if (!ready || !user) return <HudLoading />;

  return (
    <HudShell active="profile">
      <div className="hud-two">
        {isPatient ? (
          <HudPanel index="01" title="Personal details" sub="Used to describe your twin / Visible to you and doctors you share with">
            {!recordReady && <p className="hud-empty">Loading your profile...</p>}
            {recordReady && !record && <p className="hud-error">This account has no patient record. Ask an administrator.</p>}
            {record && <PatientForm user={user} record={record} />}
          </HudPanel>
        ) : (
          <HudPanel index="01" title="My details" sub={`Signed in as ${user.email ?? "unknown"} / Role: ${role}`}>
            <NameForm user={user} initialName={name ?? user.displayName ?? ""} />
          </HudPanel>
        )}

        {isPatient && (
          <HudPanel index="02" title="Who can see my twin" sub="Sharing is your choice / Pick a doctor from the list">
            {record ? <CareTeam user={user} record={record} /> : <p className="hud-empty">Loading...</p>}
          </HudPanel>
        )}

        {role === "doctor" && (
          <HudPanel index="02" title="How patients share with you" sub="The patient decides / No codes needed">
            <p className="hud-text hud-plain">
              Patients see your name in the doctor list on their Profile page and click Share my twin. Their twin then appears in your My patients tab, and disappears if they stop sharing. Keep the name on the left recognisable.
            </p>
          </HudPanel>
        )}

        {role === "admin" && (
          <HudPanel index="02" title="Administrator" sub="This account manages users and roles">
            <p className="hud-text hud-plain">Use the Users tab to see every account and change roles. Use the All patients tab to open any patient&apos;s twin, read only.</p>
          </HudPanel>
        )}
      </div>
    </HudShell>
  );
}
