import { executeSuiteQL } from '../../artifacts/api-server/src/lib/netsuite.js';

async function main() {
  const queries: [string, string][] = [
    ['ItemAttributeValue', 'SELECT * FROM ItemAttributeValue WHERE ROWNUM <= 3'],
    ['CustomRecord-attr', "SELECT id, scriptid, name FROM CustomRecordType WHERE LOWER(scriptid) LIKE '%attr%' AND ROWNUM <= 10"],
    ['CustomList-attr', "SELECT id, scriptid, name FROM CustomList WHERE LOWER(scriptid) LIKE '%attr%' AND ROWNUM <= 10"],
  ];

  for (const [name, q] of queries) {
    try {
      const r = await executeSuiteQL(q);
      console.log(name + ':', JSON.stringify(r.items.slice(0, 5), null, 2));
    } catch (e: any) {
      console.log(name + ' FAILED:', e.message.substring(0, 250));
    }
  }
  process.exit(0);
}
main();
