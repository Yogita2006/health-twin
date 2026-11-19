"use client";

// A short checklist for new patients. Each step ticks itself off from real
// data: the profile, the twin's first reading, and the sharing list.
import { useState } from "react";
import Link from "next/link";
import { User } from "firebase/auth";
import { HudPanel } from "@/components/hud/Hud";
import { apiError, callApi } from "@/lib/api/client";
import { PatientRecord } from "@/lib/patient";

const HIDE_KEY = "twin-hide-getting-started";

function readHidden(): boolean {
  try {
    return window.localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function GettingStarted({ user, record, hasData }: { user: User; record: PatientRecord | null; hasData: boolean }) {
  const [hidden, setHidden] = useState(readHidden);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const profileDone = !!record?.profile;
  const sharingDone = (record?.assignedDoctorIds.length ?? 0) > 0;
  const required = profileDone && hasData;

  // Once the two required steps are done, the panel can be hidden for good.
  if (hidden && required) return null;

  async function loadSample() {
    setBusy(true);
    setMessage("");
    const result = await callApi(user, "POST", "/api/sample-data");
    setMessage(result.ok ? (result.message ?? "Sample data loaded.") : apiError(result));
    setBusy(false);
  }

  function hide() {
    try {
      window.localStorage.setItem(HIDE_KEY, "1");
    } catch {
      // Private browsing can block storage; hiding then lasts until the page reloads.
    }
    setHidden(true);
  }

  const mark = (done: boolean) => <span className={done ? "hud-step-mark hud-step-done" : "hud-step-mark"}>{done ? "Done" : "To do"}</span>;

  return (
    <HudPanel
      index="00"
      title="Getting started"
      sub="Three steps to a working twin"
      right={
        required ? (
          <button onClick={hide} className="hud-btn hud-btn-quiet">
            Hide
          </button>
        ) : undefined
      }
    >
      <div className="hud-steps">
        <div className="hud-step">
          {mark(profileDone)}
          <p className="hud-item-name">1. Fill in your profile</p>
          <Link href="/profile" className="hud-btn">
            Open profile
          </Link>
        </div>
        <div className="hud-step">
          {mark(hasData)}
          <p className="hud-item-name">2. Give your twin data</p>
          <div className="hud-chips">
            <button onClick={loadSample} disabled={busy} className="hud-btn hud-btn-solid">
              {busy ? "Loading" : "Load sample data"}
            </button>
            <Link href="/wearable" className="hud-btn">
              Send readings
            </Link>
          </div>
        </div>
        <div className="hud-step">
          {mark(sharingDone)}
          <p className="hud-item-name">3. Share with a doctor (optional)</p>
          <Link href="/profile" className="hud-btn">
            Choose a doctor
          </Link>
        </div>
      </div>
      {message && <p className="hud-success">{message}</p>}
    </HudPanel>
  );
}
