import { describe, it, expect } from 'vitest';
import { sortStorageGroups, STORAGE_SORT_OPTIONS, type StorageSortItem, type StorageSortKey } from './storageSort';

const item = (name: string, bay: string, position: number, storedAt: string): StorageSortItem => ({
  name,
  bay,
  position,
  storedAt: new Date(storedAt),
});

const bikes = [
  item('Charlie', 'B', 2, '2026-11-05T09:00:00Z'),
  item('alice', 'A', 3, '2026-11-08T09:00:00Z'),
  item('Bob', 'A', 1, '2026-11-01T09:00:00Z'),
];

const namesIn = (key: StorageSortKey) => sortStorageGroups(bikes, key).map((b) => b.name);

describe('Bikes in storage sort', () => {
  it('offers Bay, A-Z, Z-A, Newest and Oldest', () => {
    expect(STORAGE_SORT_OPTIONS.map((o) => o.label)).toEqual(['Bay', 'A-Z', 'Z-A', 'Newest', 'Oldest']);
  });

  it('sorts A-Z ignoring letter case', () => {
    expect(namesIn('az')).toEqual(['alice', 'Bob', 'Charlie']);
  });

  it('sorts Z-A as the reverse', () => {
    expect(namesIn('za')).toEqual(['Charlie', 'Bob', 'alice']);
  });

  it('puts the newest stored bike first', () => {
    expect(namesIn('newest')).toEqual(['alice', 'Charlie', 'Bob']);
  });

  it('puts the oldest stored bike first', () => {
    expect(namesIn('oldest')).toEqual(['Bob', 'Charlie', 'alice']);
  });

  it('keeps bay order by default', () => {
    expect(namesIn('bay')).toEqual(['Bob', 'alice', 'Charlie']);
  });

  it('falls back to bay order for an unknown filter', () => {
    expect(namesIn('nope' as StorageSortKey)).toEqual(['Bob', 'alice', 'Charlie']);
  });

  it('does not reorder the caller’s list', () => {
    sortStorageGroups(bikes, 'newest');
    expect(bikes.map((b) => b.name)).toEqual(['Charlie', 'alice', 'Bob']);
  });
});
