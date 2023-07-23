import { describe, it, vi, beforeEach, expect } from 'vitest';
import type { Actor, Dataset, DatasetContent, KeyValueStore, ActorRun } from 'apify';
import { random } from 'lodash';

import { FieldMismatch, runDataIntegrityCheck } from '../dataIntegrity';

const createMockKeyValueStore = (cache?: object) =>
  ({
    setValue: async (key: string, value: any) => {
      if (cache) cache[key] = value;
    },
  } as KeyValueStore);

const createMockDataset = (input?: { items?: any[] }) => {
  const items = input?.items ?? [];

  return {
    drop: async () => {
      items.splice(0, items.length);
    },
    pushData: async (newItems: any[]) => {
      items.push(...newItems);
    },
    getData: () => Promise.resolve({ items } as DatasetContent<any>),
  } as Dataset;
};

const createMockOpenDataset = (datasets: Record<string, any[]>) => {
  const openDataset: typeof Actor.openDataset = async (datasetId, options) => {
    return createMockDataset({ items: datasets?.[datasetId ?? 'default'] });
  };
  return openDataset;
};

const createMockOpenKeyValueStore = (stores: Record<string, object>) => {
  const openKeyValueStore: typeof Actor.openKeyValueStore = async (keyValueStoreId, options) => {
    return createMockKeyValueStore(stores?.[keyValueStoreId ?? 'default']);
  };
  return openKeyValueStore;
};

const createMockCallActor = (input?: Partial<ActorRun>) => {
  const callActor: typeof Actor.call = async (actorId, actorInput, options) => {
    return { ...input } as ActorRun;
  };
  return callActor;
};

const createMockPushData = (collector?: any[]) => {
  const pushData = async (itemOrItems: any | any[], ctx: any, options: any) => {
    const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    collector?.push(...items);
    return items;
  };
  return pushData;
};

const createMockDatasetEntry = (n: number, rand?: number) => {
  const randNum = rand ?? random(1, 10000);
  return {
    id1: `id1_${n}`,
    id2: `id2_${n}`,
    dynamicField: `dyn_${n}_${randNum}`,
    warnField: `warn_${n}_${randNum}`,
    matchField: `match_${n}`,
    errorField: `error_${n}_${randNum}`,
  };
};

const createExpectedFieldMismatchEntry = ({
  n,
  fieldName,
  fieldValueMatcher,
  referenceItem,
  testItem,
  severity,
}: {
  n: number;
  fieldName: string;
  fieldValueMatcher: any;
  referenceItem: any;
  testItem: any;
  severity?: 'ERROR' | 'WARN';
}) =>
  ({
    fieldName,
    fieldTypeMismatch: false,
    fieldValueReference: fieldValueMatcher,
    fieldValueTested: fieldValueMatcher,
    itemCacheId: expect.any(String),
    itemKeys: { id1: `id1_${n}`, id2: `id2_${n}` },
    itemTypeMismatch: true,
    itemValueReference: referenceItem,
    itemValueTested: testItem,
    severity: severity ?? 'ERROR',
  } satisfies FieldMismatch);

describe(runDataIntegrityCheck.name, () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('', async () => {
    const actorRun: Partial<ActorRun> = {
      status: 'SUCCEEDED',
    };

    const datasets = {
      actorDataset: [
        createMockDatasetEntry(1, 10), // Is in comparison dataset, but with diff values --> Error
        createMockDatasetEntry(2, 20), // Is in comparison dataset, but with diff values --> Error
        createMockDatasetEntry(3, 30), // Is in comparison dataset, and values match --> NO error
        createMockDatasetEntry(4, 40), // NOT in comparison dataset --> Ignored
      ],
      comparisonDataset: [
        createMockDatasetEntry(1, 11),
        createMockDatasetEntry(2, 22),
        createMockDatasetEntry(3, 30),
        createMockDatasetEntry(6, 66), // NOT found in actor dataset --> Stale - should be replaced
      ],
    };

    const store = {};
    const pushedItems = [];

    const mockCallActor = createMockCallActor(actorRun);
    const mockOpenDataset = createMockOpenDataset(datasets);
    const mockOpenKeyValueStore = createMockOpenKeyValueStore({ default: store });
    const mockPushData = createMockPushData(pushedItems);

    const mockActorClass = {
      openDataset: mockOpenDataset,
      callTask: mockCallActor,
      call: mockCallActor,
      openKeyValueStore: mockOpenKeyValueStore,
    };

    const input = {
      runType: 'ACTOR' as const,
      // actorOrTaskId,
      // actorOrTaskBuild,
      // actorOrTaskInput,
      actorOrTaskDatasetIdOrName: 'actorDataset',
      comparisonDatasetIdOrName: 'comparisonDataset',
      comparisonDatasetPrimaryKeys: ['id1', 'id2'],
      // comparisonDatasetRemoveStaleEntries = true,
      comparisonDatasetMaxEntries: 4,
      comparisonFieldsIgnore: ['dynamicField'],
      comparisonFieldsWarn: ['warnField'],
    };

    expect(pushedItems).toStrictEqual([]);
    expect(store).toStrictEqual({});

    await runDataIntegrityCheck({ input, pushData: mockPushData }, { Actor: mockActorClass });

    // 1. Check that the dataset includes detected errors
    expect(pushedItems).toStrictEqual([
      createExpectedFieldMismatchEntry({
        n: 1,
        fieldName: 'warnField',
        fieldValueMatcher: expect.stringMatching(new RegExp(`^warn_1_`)),
        referenceItem: datasets.comparisonDataset[0],
        testItem: datasets.actorDataset[0],
        severity: 'WARN',
      }),
      createExpectedFieldMismatchEntry({
        n: 1,
        fieldName: 'errorField',
        fieldValueMatcher: expect.stringMatching(new RegExp(`^error_1_`)),
        referenceItem: datasets.comparisonDataset[0],
        testItem: datasets.actorDataset[0],
        severity: 'ERROR',
      }),
      createExpectedFieldMismatchEntry({
        n: 2,
        fieldName: 'warnField',
        fieldValueMatcher: expect.stringMatching(new RegExp(`^warn_2_`)),
        referenceItem: datasets.comparisonDataset[1],
        testItem: datasets.actorDataset[1],
        severity: 'WARN',
      }),
      createExpectedFieldMismatchEntry({
        n: 2,
        fieldName: 'errorField',
        fieldValueMatcher: expect.stringMatching(new RegExp(`^error_2_`)),
        referenceItem: datasets.comparisonDataset[1],
        testItem: datasets.actorDataset[1],
        severity: 'ERROR',
      }),
    ]);

    // 2. Check that summary stats were pushed to the key-value store
    expect(store).toStrictEqual({
      DATA_INTEGRITY_STATS: {
        referenceItemsFound: 3,
        referenceItemsNotFound: 1,
        referenceItemsSuccess: 1,
        referenceItemsFail: 2,
      },
    });

    // 3. Check that the reference dataset had stale entries replaced with fresh ones
    expect(datasets.comparisonDataset).toStrictEqual([
      createMockDatasetEntry(1, 11),
      createMockDatasetEntry(2, 22),
      createMockDatasetEntry(3, 30),
      createMockDatasetEntry(4, 40), // Stale entry was replaced with one from the scraped dataset
    ]);
  });
});
