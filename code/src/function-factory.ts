import process_playstore_reviews from './functions/get_hashtag';

export const functionFactory = {
  process_playstore_reviews,
} as const;

export type FunctionFactoryType = keyof typeof functionFactory;
