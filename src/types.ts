import { fromPairs } from 'lodash';

import type { ArrVal } from './utils/types';

const enumFromArray = <T extends readonly any[]>(arr: T) => {
  return fromPairs(arr.map((k) => [k, k])) as { [Key in ArrVal<T>]: Key };
};

export const RUN_TYPE = ['ACTOR', 'TASK'] as const; // prettier-ignore
export type RunType = ArrVal<typeof RUN_TYPE>;
