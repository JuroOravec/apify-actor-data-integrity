import { capitalize } from 'lodash';
import {
  createActorConfig,
  createActorInputSchema,
  createBooleanField,
  createIntegerField,
  createStringField,
  createArrayField,
  Field,
  ActorInputSchema,
  createActorOutputSchema,
  createObjectField,
} from 'apify-actor-config';
import {
  MetamorphActorInput,
  OutputActorInput,
  metamorphInput,
  outputInput,
} from 'apify-actor-utils';

import actorSpec from './actorspec';
import { RUN_TYPE, RunType } from './types';

// const createTagFn = (tag: string) => (t: string) => `<${tag}>${t}</${tag}>`;
// const strong = createTagFn('strong');
const newLine = (repeats = 1) => '<br/>'.repeat(repeats);

export interface CustomActorInput {
  /**
   * Whether to call an actor or a task
   *
   * Default: `'ACTOR'`
   */
  runType: RunType;
  /**
   * Actor or task to call. Allowed formats are `username/actor-name`, `userId/actor-name` or actor ID.
   *
   * Can be omitted if you already have an existing Dataset and you don't need to run an Acor to generate
   * the Dataset.
   *
   * Either `actorOrTaskId` or `actorOrTaskDatasetIdOrName` MUST be given.
   */
  actorOrTaskId?: string;
  /**
   * Tag or number of the actor build to run (e.g. `beta` or `1.2.345`).
   * If not provided, the run uses build tag or number from the default actor run configuration (typically `latest`).
   */
  actorOrTaskBuild?: string;
  /**
   * Input for the actor. An object is expected, which will be stringified to
   * JSON and its content type set to `application/json; charset=utf-8`.
   */
  actorOrTaskInput?: object;
  /**
   * ID or name of the dataset that stores entries scraped by the given actor or task.
   *
   * Either `actorOrTaskId` or `actorOrTaskDatasetIdOrName` MUST be given.
   *
   * Default: Run's default dataset.
   */
  actorOrTaskDatasetIdOrName?: string;
  /** ID or name of the dataset that stores entries from previous runs used for comparison */
  comparisonDatasetIdOrName: string;
  /** Define fields used for matching entries between scraped and comparison datasets */
  comparisonDatasetPrimaryKeys?: string[];
  /**
   * Scraped entries naturally get stale (e.g. a job offer is closed and removed from website).
   * In such case, the entries in the comparison dataset can no longer be found in the scraped dataset,
   * so we can't use them for comparison anymore.
   *
   * Instead, we can replace these "stale" entries, so that the next time we run the comparison,
   * we will again be able to find all entries.
   *
   * If `true`, stale entries are automatically replaced if detected.
   *
   * You might want to set this to `false` if you have a referential dataset that you want
   * to update manually.
   *
   * Default: `true`
   */
  comparisonDatasetRemoveStaleEntries?: boolean;
  /**
   * How many entries should be stored in the comparison dataset.
   *
   * Even with a dataset of thousands of entries, you should need only lower tens of entries to
   * test the data integrity (assuming that these entries are well-diverse).
   *
   * Default: `20`
   */
  comparisonDatasetMaxEntries?: number;
  /**
   * Some fields may change with every run (e.g. extraction timestamp). Such fields should be
   * ignored from the data integrity check to avoid false alerts.
   */
  comparisonFieldsIgnore?: string[];
  /**
   * Some fields are either not as important, or their value may change more often than other fields
   * (e.g. a job ad description may be corrected a few times over its lifetimes). You can mark such
   * fields to be classified as "warnings" instead of "errors".
   */
  comparisonFieldsWarn?: string[];
}

/** Shape of the data passed to the actor from Apify */
export interface ActorInput
  // Include the common fields in input
  extends OutputActorInput,
    MetamorphActorInput,
    CustomActorInput {}

const datasetIdPattern = '^[a-zA-Z0-9][a-zA-Z0-9-]*$';

const customActorInput: Record<keyof CustomActorInput, Field> = {
  runType: createStringField<RunType>({
    type: 'string',
    title: 'Run type (actor or task)',
    description: `Whether to call an actor or a task`,
    editor: 'select',
    example: 'ACTOR',
    default: 'ACTOR',
    prefill: 'ACTOR',
    enum: RUN_TYPE,
    enumTitles: RUN_TYPE.map(capitalize),
    nullable: false,
  }),
  actorOrTaskId: createStringField({
    title: 'Actor or Task ID',
    type: 'string',
    description: `Actor or task to call. Allowed formats are \`username/actor-name\`, \`userId/actor-name\` or actor ID.${newLine(2)}
    Can be omitted if you already have an existing Dataset and you don't need to run an Acor to generate the Dataset.${newLine(2)}
    Either \`actorOrTaskId\` or \`actorOrTaskDatasetIdOrName\` MUST be given.`, // prettier-ignore
    editor: 'textfield',
    example: 'username/actor-name',
    nullable: true,
  }),
  actorOrTaskBuild: createStringField({
    title: 'Actor or Task build',
    type: 'string',
    description: `Tag or number of the actor build to run (e.g. \`beta\` or \`1.2.345\`).${newLine(2)}
    If not provided, the run uses build tag or number from the default actor run configuration (typically \`latest\`).`, // prettier-ignore
    editor: 'textfield',
    example: '1.2.345',
    nullable: true,
  }),
  actorOrTaskInput: createObjectField({
    title: 'Actor or Task input',
    type: 'object',
    description: `Input for the actor. An object is expected, which will be stringified to JSON and its content type set to \`application/json; charset=utf-8\`.`,
    editor: 'json',
    example: { actorInputField1: true },
    nullable: true,
  }),
  actorOrTaskDatasetIdOrName: createStringField({
    title: 'Actor or Task output Dataset ID',
    type: 'string',
    description: `ID or name of the dataset that stores entries scraped by the given actor or task.${newLine(2)}
    Either \`actorOrTaskId\` or \`actorOrTaskDatasetIdOrName\` MUST be given.${newLine(2)}
    Default: Run's default dataset.${newLine(2)}
    <strong>NOTE:<strong> Dataset name can only contain letters 'a' through 'z', the digits '0' through '9', and the hyphen ('-') but only in the middle of the string (e.g. 'my-value-1').
    <a href="https://docs.apify.com/sdk/python/docs/concepts/storages#opening-named-and-unnamed-storages">Learn more</a>`, // prettier-ignore
    editor: 'textfield',
    example: 'mIJVZsRQrDQf4rUAf',
    pattern: datasetIdPattern,
    nullable: true,
  }),

  comparisonDatasetIdOrName: createStringField({
    title: 'Comparison Dataset ID',
    type: 'string',
    description: `ID or name of the dataset that stores entries from previous runs used for comparison.
    <a href="https://docs.apify.com/sdk/python/docs/concepts/storages#opening-named-and-unnamed-storages">Learn more</a><br/><br/>
    <strong>NOTE:<strong> Dataset name can only contain letters 'a' through 'z', the digits '0' through '9', and the hyphen ('-') but only in the middle of the string (e.g. 'my-value-1')`,
    editor: 'textfield',
    example: 'mIJVZsRQrDQf4rUAf',
    pattern: datasetIdPattern,
    nullable: false,
  }),
  comparisonDatasetPrimaryKeys: createArrayField<string[]>({
    title: 'Comparison - Primary keys',
    type: 'array',
    description: `Define fields used for matching entries between scraped and comparison datasets.<br/><br/>
    <strong>NOTE:<strong> If not set, the entries are hashed based on all fields`,
    editor: 'stringList',
    example: ['name', 'city'],
    nullable: true,
  }),
  comparisonDatasetRemoveStaleEntries: createBooleanField({
    title: 'Comparison - Replace stale entries',
    type: 'boolean',
    description: `Scraped entries naturally get stale (e.g. a job offer is closed and removed from website). In such case, the entries in the comparison dataset can no longer be found in the scraped dataset, so we can't use them for comparison anymore. ${newLine(2)}
    Instead, we can replace these "stale" entries, so that the next time we run the comparison, we will again be able to find all entries.${newLine(2)}
    If \`true\`, stale entries are automatically replaced if detected.${newLine(2)}
    You might want to set this to \`false\` if you have a referential dataset that you want to update manually.`, // prettier-ignore
    default: true,
    example: true,
    nullable: true,
  }),
  comparisonDatasetMaxEntries: createIntegerField({
    title: 'Comparison - Max entries',
    type: 'integer',
    description: `How many entries should be stored in the comparison dataset.${newLine(2)}
      Even with a dataset of thousands of entries, you should need only lower tens of entries to test the data integrity (assuming that these entries are well-diverse).`,
    example: 20,
    prefill: 20,
    default: 20,
    minimum: 1,
    nullable: true,
  }),
  comparisonFieldsIgnore: createArrayField<string[]>({
    title: 'Comparison - Ignored fields',
    type: 'array',
    description: `Some fields may change with every run (e.g. extraction timestamp). Such fields should be ignored from the data integrity check to avoid false alerts.`,
    editor: 'stringList',
    example: ['name', 'city'],
    nullable: true,
  }),
  comparisonFieldsWarn: createArrayField<string[]>({
    title: 'Comparison - Warning fields',
    type: 'array',
    description: `Some fields are either not as important, or their value may change more often than other fields (e.g. a job ad description may be corrected a few times over its lifetimes). You can mark such fields to be classified as "warnings" instead of "errors".`,
    editor: 'stringList',
    example: ['name', 'city'],
    nullable: true,
  }),
};

const inputSchema = createActorInputSchema<ActorInputSchema<Record<keyof ActorInput, Field>>>({
  schemaVersion: 1,
  title: actorSpec.actor.title,
  description: `Configure the ${actorSpec.actor.title}.`,
  type: 'object',
  properties: {
    ...customActorInput,
    // Include the common fields in input
    ...outputInput,
    ...metamorphInput,
  },
});

const outputSchema = createActorOutputSchema({
  actorSpecification: 1,
  fields: {},
  views: {},
});

const config = createActorConfig({
  actorSpecification: 1,
  name: actorSpec.platform.actorId,
  title: actorSpec.actor.title,
  description: actorSpec.actor.shortDesc,
  version: '1.0',
  dockerfile: './Dockerfile',
  input: inputSchema,
  storages: {
    dataset: outputSchema,
  },
});

export default config;
