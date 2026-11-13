"use client";

// Live list of a patient's most recent readings, oldest first, for charts.
import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Reading } from "@/lib/engine/types";

export function useRecentReadings(uid: string | null, max = 60) {
  const [readings, setReadings] = useState<Reading[]>([]);

  useEffect(() => {
    if (!uid) return;
    const recent = query(collection(db, "patients", uid, "readings"), orderBy("ts", "desc"), limit(max));
    return onSnapshot(
      recent,
      (snap) => setReadings(snap.docs.map((d) => d.data() as Reading).reverse()),
      (err) => console.error("Could not load readings:", err)
    );
  }, [uid, max]);

  return readings;
}
