
Data Change Monitoring
===============================

Monitor data changes between scraper runs or other datasets. Get a report on what fields changed.


## What is Data Change Monitoring and how it works?

Do you use or manage a scraper that runs regularly (daily, weekly, monthly...)?

How do you ensure that the scraper is still collecting the data correctly? How do you monitor changes?

Usually the strategies go like this:
1. No monitoring
2. Check for errors
3. Validate results for correct shape and type.

However, this still doesn't save you from unexpected changes. Subtler changes, especially in textual data, are harder to track. Examples:
- Maybe a website starts to prefix post titles with tags - From `'Some title'` to `'[meta] Some title'`.
- Maybe a change in the website HTML means that instead of a product description, you will start receiving a string `'-'`.

Anticipating these change in advance is almost impossible, and writing elaborate regexes to catch these changes
can get prohibitevely complex.

**This is where Data Change Monitoring comes to help.**

### How it works

The Data Change Monitoring actor can be used in two ways:

1. **Static testing** - You define a static dataset (updated manually) of entries you expect. After scraping a website, you can compare the scraped data against the static dataset to detect changes.

2. **Change monitoring** - Instead of a static dataset, you compare the scraper entries against entries from a previous scraper run.
   - Example: Each day, the data change monitoring is run against a scraper that produces a dataset. If the entries sampled from today's dataset are different from yesterday's run, this will be picked up and reported. (And after the actor is done, a sample from today's entries are saved to be used for tomorrow's comparison.)
   - When an entry stops being available in the scraped dataset, it is considered stale, and it's replaced with other entry. This way, the data change monitoring can be run regularly over long periods of time without any manual intervention.

This actor takes two datasets, and verifies that a sample of entries that are common to both datasets are indeed identical. Output is a list of discrepancies that occurred between the two datasets.

The two datasets are:
  - **Reference dataset** - The source of truth of what entries we expect.
  - **Tested dataset** - Incoming (unknown) dataset that we want to check against the reference dataset.

The entries common to both datasets are identified by `primary keys` - combination of fields that together uniquely identify the entries.

  - For example, the combination of keys `'firstName'` and `'lastName'` uniquely identifies the entries in following dataset:

    ```js
      [{
        firstName: 'John',
        lastName: 'Doe',
        hobbies: ['skiing', 'hiking', 'travel'],
      }, {
        firstName: 'Ann',
        lastName: 'Doe',
        hobbies: ['crossfit', 'running', 'gardening'],
      }]
    ```

The **Tested dataset** can be specified either as an Apify Dataset, or as an Apify Actor (or Task) run. In other words, another actor can be triggered to generate the dataset to be tested. This way, you can run another actor that obtains scraped data in real time, and once it finishes, the data change monitoring actor will check if the scraped data matches the expected dataset.



See the [outputs section](#outputs) for a detailed description.

The data can be downloaded in JSON, JSONL, XML, CSV, Excel, or HTML formats.

## Features

This actor is a robust production-grade solution suitable for businesses and those that need reliability.

Hence, beside its primary function, the Data Change Monitoring actor comes packing with the following:

- **Integrated data filtering and transformation**
  
  - Filter and modify the output dataset entries out of the box from within Apify UI (via custom JavaScript functions), without needing other tools.

- **Integrated cache**
  
  - You can use cache together with custom filtering to e.g. save only NEW entries to the output dataset. Save time and reduce cost.
  - Cache automatically stores which entries were already scraped. Cache can persist between different scraper runs.

- **Tested daily for high reliability**
  
  - The actor is regularly tested end-to-end to minimize the risk of a broken integration.

- **Metamorphing - Pass result dataset to other actors**
  
  - Automatically trigger another actor when this one is done to process the resulting dataset.
  - Metamorphing means that the dataset and key-value store is passed to another actor.
  - Actor metamorph can be configure via actor input. No need to define custom actors just for that.

## How to use Data Change Monitoring actor

1. Create a free Apify account using your email
2. Open Data Change Monitoring actor
3. In Input, select the datasets to compare.
4. Click "Start" and wait for the report to be generated.
5. Download your data in JSON, JSONL, XML, CSV, Excel, or HTML format.

## Input options

For details and examples for all input fields, please visit the [Input tab](https://apify.com/jurooravec/data-integrity/input-schema).

### Input examples

#### Example 1

- Compare two datasets.
- Entries are identified by first and last name.
- Discrepancies in timestamps are ignored.
- Comparison (reference) dataset is static (needs to be updated manually).

```json
{
  "actorOrTaskDatasetIdOrName": "njkdaldawhd",
  "comparisonDatasetIdOrName": "u8p93qf3w8",
  "comparisonDatasetPrimaryKeys": ["firstName", "lastName"],
  "comparisonDatasetRemoveStaleEntries": false,
  "comparisonFieldsIgnore": ["timestamp"],
  "comparisonFieldsWarn": ["someLessImportantField"],
}
```

#### Example 2

- Compare a dataset with results from an actor run with a given input.
- Entries are identified by "id" field.
- The comparison (reference) dataset should include up to 50 entries, and stale entries are replaced.

```json
{
  "runType": "ACTOR",
  "actorOrTaskId": "jurooravec/actor-name",
  "actorOrTaskBuild": "1.2.3",
  "actorOrTaskInput": {
    "inputField1": "a",
    "inputField2": [],
  },
  "comparisonDatasetIdOrName": "u8p93qf3w8",
  "comparisonDatasetPrimaryKeys": ["id"],
  "comparisonDatasetRemoveStaleEntries": true,
  "comparisonDatasetMaxEntries": 50,
}
```

## Outputs

Once the actor is done, you can see the overview of results in the Output tab.

To export the data, head over to the Storage tab.

![Data Change Monitoring actor dataset overview](/public/imgs/data-integrity-actor-dataset-overview.png)


## Sample output from Data Change Monitoring

```json
{
  // Field where the change occured
  "fieldName": "description",
  // Whether the change in this field is considered an error or a warning
  "severity": "ERROR",
  // Whether there was a type mismatch on the field level
  "fieldTypeMismatch": false,
  // Value of the field on the reference (comparison) entry
  "fieldValueReference": ["skiing", "hiking", "travel"],
  // Value of the field on the tested entry
  "fieldValueTested": ["skiing (sport)", "hiking (sport)", "travel (lifestyle)"],
  // Whether there was a type mismatch on the item level
  "itemTypeMismatch": false,
  // Fields and their values that were used as primary keys
  "itemKeys": {
    "firstName": "John",
    "lastName": "Doe",
  },
  // JSON of the reference (comparison) entry
  "itemValueReference": {
    "firstName": "John",
    "lastName": "Doe",
    "hobbies": ["skiing", "hiking", "travel"],
  },
  // JSON of the tested entry
  "itemValueReference": {
    "firstName": "John",
    "lastName": "Doe",
    "hobbies": ["skiing (sport)", "hiking (sport)", "travel (lifestyle)"],
  },
}
```

## How to integrate Data Change Monitoring with other services, APIs or Actors

You can connect the actor with many of the
[integrations on the Apify platform](https://apify.com/integrations).
You can integrate with Make, Zapier, Slack, Airbyte, GitHub, Google Sheets, Google Drive,
[and more](https://docs.apify.com/integrations).
Or you can use
[webhooks](https://docs.apify.com/integrations/webhooks)
to carry out an action whenever an event occurs, e.g. get a notification whenever
Instagram API Scraper successfully finishes a run.

## Use Data Change Monitoring with Apify API

The Apify API gives you programmatic access to the Apify platform.
The API is organized around RESTful HTTP endpoints that enable you to manage,
schedule and run Apify actors. The API also lets you access any datasets,
monitor actor performance, fetch results, create and update versions, and more.

To access the API using Node.js, use the `apify-client` NPM package.
To access the API using Python, use the `apify-client` PyPI package.

Check out the [Apify API reference](https://docs.apify.com/api/v2) docs
for full details or click on the
[API tab](https://apify.com/jurooravec/data-integrity/api)
for code examples.

## Who can I contact for issues with Data Change Monitoring actor?

To report issues and find help,
head over to the
[Discord community](https://discord.com/channels/801163717915574323), or email me at juraj[dot]oravec[dot]josefson[at]gmail[dot]com
