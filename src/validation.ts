import Joi from 'joi';
import { metamorphInputValidationFields, outputInputValidationFields } from 'apify-actor-utils';

import { RUN_TYPE } from './types';
import type { ActorInput } from './config';

const inputValidationSchema = Joi.object<ActorInput>({
  ...outputInputValidationFields,
  ...metamorphInputValidationFields,

  runType: Joi.string().valid(...RUN_TYPE).required(), // prettier-ignore
  actorOrTaskId: Joi.string().min(1).optional(),
  actorOrTaskBuild: Joi.string().min(1).optional(),
  actorOrTaskInput: Joi.object().unknown(true).optional(),
  actorOrTaskDatasetIdOrName: Joi.string().min(1).optional(),
  comparisonDatasetIdOrName: Joi.string().min(1).required(),
  comparisonDatasetPrimaryKeys: Joi.array().items(Joi.string().min(1)).optional(),
  comparisonDatasetRemoveStaleEntries: Joi.boolean().optional(),
  comparisonDatasetMaxEntries: Joi.number().integer().min(1).optional(),
  comparisonFieldsIgnore: Joi.array().items(Joi.string().min(1)).optional(),
  comparisonFieldsWarn: Joi.array().items(Joi.string().min(1)).optional(),
} satisfies Record<keyof ActorInput, Joi.Schema>);

export const validateInput = (input: ActorInput | null) => {
  Joi.assert(input, inputValidationSchema);

  if (!input?.actorOrTaskId && !input?.actorOrTaskDatasetIdOrName) {
    throw Error(
      `Cannot find a dataset because neither dataset ID nor its actor was given. Either \`actorOrTaskId\` or \`actorOrTaskDatasetIdOrName\` MUST be specified. INPUT: ${JSON.stringify(
        input
      )}`
    );
  }
};
