import type { AppConfig } from '../platform-kit/src/platform/contracts.ts'

/** Keep the participant-facing OG small; full industry showcases use isolated demo installations. */
export function creatorConfig(config: AppConfig): AppConfig {
  return {
    ...config,
    modules: ['content', 'progress', 'learning', 'events', 'retention', 'commerce'],
    navigation: ['home', 'learning', 'profile'],
    homeBlocks: ['learning', 'content', 'events'],
  }
}
