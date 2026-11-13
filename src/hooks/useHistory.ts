"use client";

// Live views of a patient's longer-term data: daily summaries and the baseline.
import { useEffect, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { DailySummary } from "@/lib/engine/daily";
import { Baseline } from "@/lib/engine/types";

// The most recent days that have data, oldest first.
export function useDailySummaries(uid: string | null, days = 30) {
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const recent = query(collection(db, "patients", uid, "daily"), orderBy("day", "desc"), limit(days));
    return onSnapshot(
      recent,
      (snap) => {
        setSummaries(snap.docs.map((d) => d.data() as DailySummary).reverse());
        setReady(true);
      },
      (err) => {
        console.error("Could not load daily summaries:", err);
        setReady(true);
      }
    );
  }, [uid, days]);

  return { summaries, ready };
}

export function useBaseline(uid: string | null) {
  const [baseline, setBaseline] = useState<Baseline | null>(null);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "patients", uid, "baseline", "current"),
      (snap) => setBaseline(snap.exists() ? (snap.data() as Baseline) : null),
      (err) => console.error("Could not load the baseline:", err)
    );
  }, [uid]);

  return baseline;
}
