"use client";

// Live views of patient records and accounts, for the profile, doctor and
// admin screens.
import { useEffect, useState } from "react";
import { collection, doc, limit, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { PatientRecord } from "@/lib/patient";

export type ListedPatient = PatientRecord & { id: string };

// One patient's record: name, profile and the doctors they share with.
export function usePatientRecord(patientId: string | null) {
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!patientId) return;
    return onSnapshot(
      doc(db, "patients", patientId),
      (snap) => {
        setRecord(snap.exists() ? (snap.data() as PatientRecord) : null);
        setDenied(false);
        setReady(true);
      },
      () => {
        // The security rules refused: this person is not allowed to see this patient.
        setRecord(null);
        setDenied(true);
        setReady(true);
      }
    );
  }, [patientId]);

  return { record, ready, denied };
}

// The patients this person may see. A doctor gets the patients who shared
// with them; an admin gets everyone. The security rules enforce the same thing.
export function useVisiblePatients(uid: string | null, role: string | null) {
  const [patients, setPatients] = useState<ListedPatient[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!uid || (role !== "doctor" && role !== "admin")) return;
    const all = collection(db, "patients");
    const visible = role === "admin" ? query(all, limit(200)) : query(all, where("assignedDoctorIds", "array-contains", uid), limit(200));
    return onSnapshot(
      visible,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as PatientRecord) }));
        list.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setPatients(list);
        setReady(true);
      },
      (err) => {
        console.error("Could not load patients:", err);
        setReady(true);
      }
    );
  }, [uid, role]);

  return { patients, ready };
}

export interface Account {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

// Every account, for the admin screen. The security rules only allow an admin to read this.
export function useAccounts(enabled: boolean) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      query(collection(db, "users"), limit(500)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Account, "id">) }));
        list.sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || ""));
        setAccounts(list);
        setReady(true);
      },
      (err) => {
        console.error("Could not load accounts:", err);
        setReady(true);
      }
    );
  }, [enabled]);

  return { accounts, ready };
}
