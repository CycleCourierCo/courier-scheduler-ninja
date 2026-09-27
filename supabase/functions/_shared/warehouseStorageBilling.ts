export const STORAGE_PRODUCT_NAME = 'Warehouse Bike Storage';
export const STORAGE_NET_GBP = 33.33;

export type StoredBike = {
  id: string; user_id: string; item_kind: string; deposited_at: string;
  dispatched_at: string | null; status: string;
  bike_brand: string | null; bike_model: string | null;
  source_order_id: string | null;
};

export type StoragePeriod = {
  stock: StoredBike; number: number; start: string; end: string;
};

export function londonDate(value: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
}

function anniversary(deposit: string, monthNumber: number): string {
  const [year, month, day] = deposit.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + monthNumber, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

function dayBefore(date: string): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
}

/** Start at deposit, then each calendar-month anniversary. Catch up missed periods. */
export function dueStoragePeriods(stock: StoredBike, through: string): StoragePeriod[] {
  if (stock.item_kind !== 'bike' || !stock.deposited_at) return [];
  const deposit = londonDate(stock.deposited_at);
  const cutoff = stock.dispatched_at ? londonDate(stock.dispatched_at) :
    ['dispatched', 'returned'].includes(stock.status) ? londonDate(stock.deposited_at) : null;
  const periods: StoragePeriod[] = [];
  for (let number = 0; number < 1200; number++) {
    const start = anniversary(deposit, number);
    if (start > through || (cutoff && start >= cutoff && number > 0)) break;
    // Do not charge a new period after departure, including a bike dispatched on its anniversary.
    if (cutoff && start >= cutoff && number === 0 && cutoff < deposit) break;
    periods.push({ stock, number, start, end: dayBefore(anniversary(deposit, number + 1)) });
  }
  return periods;
}

export async function fetchCustomerStorage(supabase: any, customerId: string): Promise<StoredBike[]> {
  const all: StoredBike[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('warehouse_stock')
      .select('id,user_id,item_kind,deposited_at,dispatched_at,status,bike_brand,bike_model,source_order_id')
      .eq('user_id', customerId).eq('item_kind', 'bike')
      .order('id').range(offset, offset + 499);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  return all;
}

export async function eligibleStoragePeriods(supabase: any, customerId: string, through: string): Promise<StoragePeriod[]> {
  const stock = await fetchCustomerStorage(supabase, customerId);
  const all = stock.flatMap((bike) => dueStoragePeriods(bike, through));
  if (all.length === 0) return [];
  const ledger: Array<{ stock_id: string; period_number: number; status: string }> = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('warehouse_storage_charges')
      .select('stock_id,period_number,status').eq('customer_id', customerId)
      .order('id').range(offset, offset + 499);
    if (error) throw error;
    ledger.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  const recorded = new Set(ledger.map((row) => `${row.stock_id}:${row.period_number}`));
  return all.filter((period) => !recorded.has(`${period.stock.id}:${period.number}`));
}