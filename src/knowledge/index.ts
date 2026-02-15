export { default as KnowledgeLoader } from './loader'
export { default as SearchIndex } from './searchIndex'
export * from './types'

export default {
  KnowledgeLoader: (require('./loader').default),
  SearchIndex: (require('./searchIndex').default),
}
