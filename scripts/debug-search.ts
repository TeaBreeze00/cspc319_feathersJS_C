import 'ts-node/register';
import { SearchDocsTool } from '../src/tools/searchDocs';

(async () => {
  process.env.DEBUG_SEARCH = '1';

  const tool = new SearchDocsTool();
  const params = { query: 'authentication', limit: 5, version: 'all' };

  const res = await tool.execute(params as any);
  // Print the content and metadata
  console.log('=== Tool Result Content ===');
  console.log(res.content);
  console.log('=== Metadata ===');
  console.log(JSON.stringify((res as any).metadata, null, 2));
})();
