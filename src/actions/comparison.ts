import type { BasicCrawlingContext } from 'crawlee';
import { Actor } from 'apify';
import { ActorContext, itemCacheKey } from 'apify-actor-utils';
import {
  sampleSize,
  fromPairs,
  isPlainObject,
  isEqual,
  uniq,
  difference,
  partition,
  uniqBy,
} from 'lodash';

import type { ActorInput } from '../config';

interface FieldReport {
  /** Field name */
  fieldName: string;
  /** Whether reference and tested values match */
  match: boolean;
  /** Whether reference and tested values have same types */
  matchType: boolean;
  /** Value of the reference entry. This is the entry that describes what we expect. */
  valueReference: any;
  /** Value of the tested entry. This is what we tested against the expected value. */
  valueTested: any;
}

interface ItemReport {
  /** ID by which this item was identified */
  cacheId: string;
  /** Keys (and their values) by which this item was identified */
  keys: Record<string, string>;
  /** Whether reference and tested values match */
  match: boolean;
  /** Whether reference and tested values have same types */
  matchType: boolean;
  /** Comparison of top-level fields */
  fields: FieldReport[];
  /** Value of the reference entry. This is the entry that describes what we expect. */
  valueReference: any;
  /** Value of the tested entry. This is what we tested against the expected value. */
  valueTested: any;
}

interface FieldMismatch {
  itemCacheId: ItemReport['cacheId'];
  itemKeys: ItemReport['keys'];
  itemTypeMismatch: ItemReport['matchType'];
  itemValueReference: ItemReport['valueReference'];
  itemValueTested: ItemReport['valueTested'];
  fieldName: FieldReport['fieldName'];
  fieldTypeMismatch: FieldReport['matchType'];
  fieldValueReference: FieldReport['valueReference'];
  fieldValueTested: FieldReport['valueTested'];
  severity: 'WARN' | 'ERROR';
}

const log = {
  info: console.info,
  debug: console.debug,
};

const downloadDataset = async (datasetId: string) => {
  const dataset = await Actor.openDataset(datasetId);
  const allItems = (await dataset.getData()).items;
  return allItems;
};

const analyzeDataIntegrity = (input: {
  /**
   * Items that are being compared against the reference list of items.
   *
   * Assumptions:
   * - The number, shape, and type of these entries are not known ahead of time.
   * - This array can be potentially much larger than the reference list.
   * - When validating scraped datasets, this array contains the scraped data.
   */
  testItems: any[];
  /**
   * Items that validate the tested items.
   *
   * Assumptions:
   * - This data is known ahead of the time.
   * - This should be fairly small array, in tens - max hundreds - of entries.
   * - When validating scraped datasets, this array describes what we expect the scraped data to be.
   */
  referenceItems: any[];
  /** Function that generates cache key from the given item */
  cacheKey?: (item: any) => string;
  /**
   * Some fields may change with every run (e.g. extraction timestamp). Such fields should be
   * ignored from the data integrity check to avoid false alerts.
   */
  ignoredFields?: string[];
  /**
   * Some fields are either not as important, or their value may change more often than other fields
   * (e.g. a job ad description may be corrected a few times over its lifetimes). You can mark such
   * fields to be classified as "warnings" instead of "errors".
   */
  warnFields?: string[];
}) => {
  const { testItems, referenceItems, cacheKey = JSON.stringify, ignoredFields, warnFields } = input;

  // Prepare state so we can keep track of which test and reference items were matched (and which weren't)
  // NOTE: Since we iterate over test items, we can categorize them as we go. But for reference items,
  //       we have to tag those that we find so we can find those that we didn't find.
  const referenceMap = new Map(
    referenceItems.map((item) => [cacheKey(item), { item, found: false }])
  );
  const testItemsFound: any[] = [];
  const testItemsNotFound: any[] = [];

  const comparisons = testItems.reduce<Omit<ItemReport, 'keys'>[]>((agg, testItem) => {
    const cacheId = cacheKey(testItem);
    if (!referenceMap.has(cacheId)) {
      testItemsNotFound.push(testItem);
      return agg;
    }

    // If we got here, then the entry was also present in the reference dataset
    testItemsFound.push(testItemsFound);
    const referenceEntry = referenceMap.get(cacheId)!;
    const referenceItem = referenceEntry.item;
    referenceEntry.found = true;

    // NOTE: We DON'T enforce the items to be objects. If the items in the dataset are something
    // other than objects, we evaluate their equality.
    const isIdentical = isEqual(testItem, referenceItem);

    let matchType = false;
    if (!isPlainObject(testItem) || !isPlainObject(referenceItem)) {
      if (typeof testItem === typeof referenceItem) matchType = true;
    }

    // All fields present in either of the two items, minus the ignored fields
    const fieldKeys = difference(
      uniq([...Object.keys(referenceItem ?? {}), ...Object.keys(testItem ?? {})]),
      ignoredFields ?? []
    );

    const fieldsReport = fieldKeys.map((fieldName) => ({
      fieldName,
      match: isEqual(referenceItem[fieldName], testItem[fieldName]),
      matchType: typeof referenceItem[fieldName] === typeof testItem[fieldName],
      valueReference: referenceItem[fieldName],
      valueTested: testItem[fieldName],
    })) satisfies FieldReport[];

    const itemReport = {
      cacheId,
      match: isIdentical && fieldsReport.every((f) => f.match),
      matchType: matchType && fieldsReport.every((f) => f.matchType),
      fields: fieldsReport,
      valueReference: referenceItem,
      valueTested: testItem,
    } satisfies Omit<ItemReport, 'keys'>;

    agg.push(itemReport);
    return agg;
  }, []);

  const mismatchFields = comparisons
    .filter((item) => !item.match || !item.matchType)
    .flatMap((item) =>
      item.fields
        .filter((field) => !field.match || !field.matchType)
        .map((field) => ({
          itemCacheId: item.cacheId,
          itemTypeMismatch: !item.matchType,
          itemValueReference: item.valueReference,
          itemValueTested: item.valueTested,
          fieldName: field.fieldName,
          fieldTypeMismatch: !field.matchType,
          fieldValueReference: field.valueReference,
          fieldValueTested: field.valueTested,
          severity: warnFields?.includes(field.fieldName) ? 'WARN' : 'ERROR',
        }))
    ) satisfies Omit<FieldMismatch, 'itemKeys'>[];

  const [referenceItemsFound, referenceItemsNotFound] = partition(
    [...referenceMap.values()],
    ({ found }) => found
  );

  return {
    mismatchFields,
    referenceItemsFound,
    referenceItemsNotFound,
    testItemsFound,
    testItemsNotFound,
  };
};

export const runDataIntegrityCheck = async <
  T extends ActorContext<BasicCrawlingContext<any>, any, ActorInput>
>(
  actor: T
) => {
  const {
    runType = 'ACTOR',
    actorOrTaskId,
    actorOrTaskBuild,
    actorOrTaskInput,
    actorOrTaskDatasetIdOrName,
    comparisonDatasetIdOrName,
    comparisonDatasetPrimaryKeys,
    comparisonDatasetRemoveStaleEntries = true,
    comparisonDatasetMaxEntries = 20,
    comparisonFieldsIgnore,
    comparisonFieldsWarn,
  } = actor.input ?? {};

  if (!actorOrTaskId && !actorOrTaskDatasetIdOrName)
    throw Error(
      'Missing required actor input. Either "actorOrTaskId" or "actorOrTaskDatasetIdOrName" MUST be given.'
    );
  if (!comparisonDatasetIdOrName) throw Error('Missing required actor input "comparisonDatasetIdOrName"'); // prettier-ignore

  const genCacheKey = (item: any) => itemCacheKey(item, comparisonDatasetPrimaryKeys);

  // 1. Call target actor with inputs & wait for results
  let actorRunDatasetId: string | null = null;
  if (actorOrTaskId) {
    const actorRunner = runType === 'TASK' ? Actor.callTask : Actor.call;
    const actorRun = await actorRunner(actorOrTaskId, actorOrTaskInput, { build: actorOrTaskBuild }); // prettier-ignore
    actorRunDatasetId = actorRun.defaultDatasetId;

    if (actorRun.status !== 'SUCCEEDED') {
      throw Error(`Actor run did not succeed. ${actorRun.status}: ${actorRun.statusMessage}`);
    }
  }

  const scrapedDatasetId = actorOrTaskDatasetIdOrName || actorRunDatasetId;
  if (!scrapedDatasetId) {
    throw Error("Cannot obtain actor dataset. Make sure the actor's dataset exists.");
  }

  // 2. Get scraped items
  const scrapedItems = await downloadDataset(scrapedDatasetId);
  // 3. Get cached items that we'll use for comparison
  const cachedItems = await downloadDataset(comparisonDatasetIdOrName);

  // 4. Identify fields that changed for the items that are present in both reference and test datasets
  const { mismatchFields, referenceItemsFound, referenceItemsNotFound, testItemsNotFound } =
    analyzeDataIntegrity({
      testItems: scrapedItems,
      referenceItems: cachedItems,
      cacheKey: genCacheKey,
      ignoredFields: comparisonFieldsIgnore,
      warnFields: comparisonFieldsWarn,
    });

  const enrichedMismatchFields = mismatchFields.map((d) => ({
    ...d,
    itemKeys: fromPairs(comparisonDatasetPrimaryKeys?.map((key) => [key, d.itemValueTested[key]])),
  })) satisfies FieldMismatch[];

  // 5. Push errors as this actor's dataset
  await actor.pushData(enrichedMismatchFields, { log } as any, {
    includeMetadata: false,
    privacyMask: {},
  });

  // 6. Prepare summary stats
  const referenceItemsFail = uniqBy(enrichedMismatchFields, (item) => item.itemCacheId);
  const stats = {
    referenceItemsFound: referenceItemsFound.length,
    referenceItemsNotFound: referenceItemsNotFound.length,
    referenceItemsSuccess: referenceItemsFound.length - referenceItemsFail.length,
    referenceItemsFail,
  };

  // 7. Print stats to log
  console.log(`STATS:\n${JSON.stringify(stats, null, 2)}`);

  // 8. Push stats to key-value store
  const kvStore = await Actor.openKeyValueStore();
  await kvStore.setValue('DATA_INTEGRITY_STATS', stats);

  // 9. Replace stale cache entries with entries that were found in the scraper run
  if (comparisonDatasetRemoveStaleEntries) {
    const numOfItemsToAddToCache = comparisonDatasetMaxEntries - referenceItemsFound.length;
    const newCacheItems = sampleSize(testItemsNotFound, numOfItemsToAddToCache);
    const finalCacheItems = [...referenceItemsFound, ...newCacheItems];

    // NOTE: Not sure if we need to call `Actor.openDataset()` both times, but since we call
    // `Dataset.drop()` I imagine that the dataset instance may become stale after that.
    await (await Actor.openDataset(comparisonDatasetIdOrName)).drop();
    await (await Actor.openDataset(comparisonDatasetIdOrName)).pushData(finalCacheItems);
  }
};
