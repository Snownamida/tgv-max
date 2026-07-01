import { aggregateByDestination } from "@/domain/availability";
import type {
  DailyCounts,
  DestinationAvailability,
  RangeDestination,
  Train,
} from "@/domain/models";
import { dateOnly } from "@/lib/dates";
import type { RawTgvmaxRecord } from "./dto";
import { and, filters } from "./query";
import type { SncfApiClient } from "./SncfApiClient";

const TRAIN_FIELDS =
  "date,train_no,heure_depart,heure_arrivee,axe,origine,destination,od_happy_card";

function toTrain(r: RawTgvmaxRecord): Train {
  return {
    date: dateOnly(r.date),
    trainNo: r.train_no,
    departure: r.heure_depart,
    arrival: r.heure_arrivee,
    axis: r.axe,
    origin: r.origine,
    destination: r.destination,
    hasMaxSeat: r.od_happy_card === "OUI",
  };
}

interface DateCountRow {
  date: string;
  n: number;
}
interface DestRangeRow {
  destination: string;
  trains: number;
  days: number;
}

/** Domain-level access to TGV MAX availability, built on top of {@link SncfApiClient}. */
export class TgvmaxRepository {
  constructor(private readonly api: SncfApiClient) {}

  /** MAX trains per day for one O/D (calendar heatmap). */
  async dailyCounts(from: string, to: string): Promise<DailyCounts> {
    const where = and(filters.from(from), filters.to(to), filters.maxSeat());
    const rows = await this.api.all<DateCountRow>(where, {
      groupBy: "date",
      select: "date, count(*) as n",
      orderBy: "date",
    });
    const counts: DailyCounts = {};
    for (const r of rows) counts[dateOnly(r.date)] = r.n;
    return counts;
  }

  /** All MAX trains for one O/D on a given date. */
  async trains(from: string, to: string, date: string): Promise<Train[]> {
    const where = and(filters.from(from), filters.to(to), filters.onDate(date), filters.maxSeat());
    const rows = await this.api.all<RawTgvmaxRecord>(where, {
      select: TRAIN_FIELDS,
      orderBy: "heure_depart",
    });
    return rows.map(toTrain);
  }

  /** Every destination with a MAX seat from one station on a date, aggregated. */
  async destinationsOn(from: string, date: string): Promise<DestinationAvailability[]> {
    const where = and(filters.from(from), filters.onDate(date), filters.maxSeat());
    const rows = await this.api.all<RawTgvmaxRecord>(
      where,
      { select: TRAIN_FIELDS, orderBy: "destination" },
      3000,
    );
    return aggregateByDestination(rows.map(toTrain));
  }

  /** Every destination reachable with a MAX seat over the whole window (map view). */
  async destinationsRange(from: string): Promise<RangeDestination[]> {
    const where = and(filters.from(from), filters.maxSeat());
    const rows = await this.api.all<DestRangeRow>(
      where,
      {
        groupBy: "destination",
        select: "destination, count(*) as trains, count(distinct date) as days",
        orderBy: "trains DESC",
      },
      3000,
    );
    return rows.map((r) => ({ destination: r.destination, trains: r.trains, days: r.days }));
  }

  /** All MAX trains for one O/D across the whole window (round-trip planning). */
  async directTrains(from: string, to: string): Promise<Train[]> {
    const where = and(filters.from(from), filters.to(to), filters.maxSeat());
    const rows = await this.api.all<RawTgvmaxRecord>(
      where,
      { select: TRAIN_FIELDS, orderBy: "date" },
      3000,
    );
    return rows.map(toTrain);
  }

  /** Timestamp of the dataset's last export (data is not real-time). */
  async lastUpdate(): Promise<string | null> {
    try {
      const meta = await this.api.datasetMeta();
      return meta.metas?.default?.data_processed ?? meta.metas?.default?.modified ?? null;
    } catch {
      return null;
    }
  }
}
