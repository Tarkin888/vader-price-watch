import { Lot } from "@/types/lot";

const DB_KEY = "vader-price-tracker-db";

interface Database {
  lots: Lot[];
}

function readDb(): Database {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    const initial: Database = { lots: [] };
    localStorage.setItem(DB_KEY, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(raw);
}

function writeDb(db: Database): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function getAllLots(): Lot[] {
  return readDb().lots;
}

export function getLotById(id: string): Lot | undefined {
  return readDb().lots.find((lot) => lot.id === id);
}

export function addLot(lot: Omit<Lot, "id" | "variantGradeKey">): Lot {
  const db = readDb();
  const newLot: Lot = {
    ...lot,
    id: crypto.randomUUID(),
    variantGradeKey: `${lot.variantCode}-${lot.gradeTierCode}`,
  };
  db.lots.push(newLot);
  writeDb(db);
  return newLot;
}

export function updateLot(id: string, updates: Partial<Omit<Lot, "id">>): Lot | null {
  const db = readDb();
  const index = db.lots.findIndex((lot) => lot.id === id);
  if (index === -1) return null;
  const updated = { ...db.lots[index], ...updates };
  if (updates.variantCode || updates.gradeTierCode) {
    updated.variantGradeKey = `${updated.variantCode}-${updated.gradeTierCode}`;
  }
  db.lots[index] = updated;
  writeDb(db);
  return updated;
}

export function deleteLot(id: string): boolean {
  const db = readDb();
  const before = db.lots.length;
  db.lots = db.lots.filter((lot) => lot.id !== id);
  writeDb(db);
  return db.lots.length < before;
}
