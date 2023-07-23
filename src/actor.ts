import type { BasicCrawlerOptions, BasicCrawlingContext } from 'crawlee';
import { ActorContext, createAndRunApifyActor } from 'apify-actor-utils';

import { validateInput } from './validation';
import { getPackageJsonInfo } from './utils/package';
import { runDataIntegrityCheck } from './actions/dataIntegrity';
import type { ActorInput } from './config';

/**
 * # Data integrity actor
 *
 * This actor takes two datasets, and verifies that the entries that are common to both datasets
 * are indeed identical.
 *
 * The two datasets are:
 * - Reference dataset - The source of truth of what entries we expect.
 * - Tested dataset - Incoming (unknown) dataset that we want to check against the reference dataset.
 *
 * The data integrity check can be used in two ways:
 * 1. For static testing - The reference dataset is static (manually updated).
 * 2. For live change monitoring - The reference dataset is automatically updated to always include entries that are also
 *    present in the tested dataset.
 *    - Example: Each day, data integrity check is run against scraped data. When an entry stops being available
 *               in the scraped dataset, it is considered stale, and it's replaced with other entry. This way,
 *               the data integrity check can be run regularly over long periods of time.
 *
 * The entries common to both datasets are identified by primary keys - combination of fields that
 * together uniquely identify the entries.
 *
 * Optionally, another actor can be triggered in order to generate the dataset to be tested.
 * This way, you can run another actor that obtains scraped data in real time, and once it
 * finishes, the data integrity actor will check if the scraped data matches the expected dataset.
 */
export const run = async (crawlerConfigOverrides?: BasicCrawlerOptions): Promise<void> => {
  const pkgJson = getPackageJsonInfo(module, ['name']);

  await createAndRunApifyActor({
    actorType: 'basic',
    actorName: pkgJson.name,
    actorConfig: {
      validateInput,
      routes: [],
      routeHandlers: {},
    },
    crawlerConfigOverrides: {
      // @ts-expect-error proxyConfiguration is intentionally null, otherwise BasicCrawler complains
      proxyConfiguration: undefined,
      ...crawlerConfigOverrides,
    },
    onActorReady: async (actor: ActorContext<BasicCrawlingContext, any, ActorInput>) => {
      await runDataIntegrityCheck(actor);

      await actor.metamorph();
    },
  });
};
