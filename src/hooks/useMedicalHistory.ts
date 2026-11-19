"use client";

// A live list of one patient's medical history. The database returns it in
// date order (newest first), and it updates by itself whenever a record is
// added, changed or deleted.
import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { HistoryRecord, byNewest } from "@/lib/history";

export function useMedicalHistory(patientId: string | null) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!patientId) return;
    return onSnapshot(
      query(collection(db, "patients", patientId, "history"), orderBy("startDate", "desc"), limit(300)),
      (snap) => {
        setRecords(snap.docs.map((d) => ({ ...(d.data() as Omit<HistoryRecord, "id">), id: d.id })).sort(byNewest));
        setReady(true);
      },
      (err) => {
        console.error("Could not load the medical history:", err);
        setReady(true);
      }
    );
  }, [patientId]);

  return { records, ready };
}
