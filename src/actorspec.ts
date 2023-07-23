import type { ActorSpec } from 'actor-spec';

const actorId = 'data-integrity';
const authorId = 'jurooravec';

const actorSpec = {
  actorspecVersion: 1,
  actor: {
    title: 'Data Change Monitoring',
    publicUrl: `https://apify.com/${authorId}/${actorId}`,
    shortDesc: 'Apify Actor that monitors data change (data integrity) of other actors or datasets',
    datasetOverviewImgUrl: '/public/imgs/data-integrity-actor-dataset-overview.png',
  },
  platform: {
    name: 'apify',
    url: 'https://apify.com',
    authorId,
    authorProfileUrl: `https://apify.com/${authorId}`,
    actorId,
    socials: {
      discord: 'https://discord.com/channels/801163717915574323',
    },
  },
  authors: [
    {
      name: 'Juro Oravec',
      email: 'juraj.oravec.josefson@gmail.com',
      authorUrl: 'https://jurora.vc',
    },
  ],
  websites: [],
  pricing: {
    pricingType: 'monthly fee',
    value: 0,
    currency: 'eur',
    period: 1,
    periodUnit: 'month',
  },
} satisfies ActorSpec;

export default actorSpec;
