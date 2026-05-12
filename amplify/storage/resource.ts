import { defineStorage } from '@aws-amplify/backend';

/**
 * S3 bucket for review screenshots.
 *
 * Layout:
 *   reviews/{owner}/{reviewId}.jpg
 *
 * - Each staff member can read/write their own folder.
 * - Members of the `admin` Cognito group can read/write/delete all folders.
 * - No public access anywhere.
 */
export const storage = defineStorage({
  name: 'bclReviewScreenshots',
  access: (allow) => ({
    'reviews/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.groups(['admin']).to(['read', 'write', 'delete']),
    ],
  }),
});
