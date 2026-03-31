export { default as KnowledgeLoader } from './loader';
export * from './types';
export { runBackgroundSync } from './syncManager';

export default {
  KnowledgeLoader: require('./loader').default,
};
