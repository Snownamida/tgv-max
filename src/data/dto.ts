/** Raw data-transfer objects returned by the SNCF OpenDataSoft API. */

/** A raw record from the « tgvmax » dataset. */
export interface RawTgvmaxRecord {
  date: string;
  train_no: string;
  entity: string;
  axe: string;
  origine_iata: string;
  destination_iata: string;
  origine: string;
  destination: string;
  heure_depart: string;
  heure_arrivee: string;
  od_happy_card: "OUI" | "NON";
}

/** Envelope returned by the records endpoint. */
export interface RecordsResponse<T> {
  total_count: number;
  results: T[];
}

/** Dataset metadata envelope (subset we care about). */
export interface DatasetMeta {
  metas?: { default?: { data_processed?: string; modified?: string } };
}
