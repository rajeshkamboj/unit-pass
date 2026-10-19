/** Focused Phase 5 checks, no test framework. Run: pnpm verify:documents.
 * Real RLS lives in supabase/tests. These checks cover signatures, validation,
 * action compensation and route authorization with deliberately mocked I/O.
 * They do NOT replace a live Supabase Storage HTTP test.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));
function load(relative, mocks = {}) {
  const file = resolve(root, relative);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file,
  }).outputText;
  const module = { exports: {} };
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === 'server-only') return {};
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`, mocks);
    return require(name);
  };
  runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(localRequire, module, module.exports);
  return module.exports;
}
const checks = [];
async function check(name, fn) { await fn(); checks.push(name); console.log(`PASS: ${name}`); }
const storage = load('src/lib/storage/documents.ts');
const { documentSchema, publicDocumentsSchema } = load('src/lib/validation/document.ts');
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const E = '55555555-5555-4555-8555-555555555551';
const D = '99999999-9999-4999-8999-999999999991';
const T = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const path = `${A}/${E}/${D}-warranty.pdf`;
const pdf = new File(['%PDF-1.7\nfixture'], 'warranty.pdf', { type: 'application/pdf' });

await check('hosted Storage preflight reads RLS catalog without altering the managed table', () => {
  const migration = readFileSync(resolve(root, 'supabase/migrations/20261105000001_phase5_documents.sql'), 'utf8');
  const sql = migration.replace(/--.*$/gm, '');
  assert.doesNotMatch(sql, /alter\s+table\s+(?:if\s+exists\s+)?(?:"storage"|storage)\s*\.\s*(?:"objects"|objects)\s/i);
  const preflight = sql.match(/do \$storage_rls\$[\s\S]*?\$storage_rls\$;/i)?.[0];
  assert.ok(preflight, 'Expected a read-only Storage RLS precondition');
  assert.match(preflight, /pg_catalog\.pg_class[\s\S]*relrowsecurity/i);
  assert.match(preflight, /raise exception[\s\S]*errcode = '55000'/i);
  for (const operation of ['select', 'insert', 'update', 'delete']) {
    assert.match(sql, new RegExp(`create policy documents_${operation}_members on storage\\.objects for ${operation} to authenticated`, 'i'));
  }
});

await check('PDF/JPEG/PNG/WEBP signatures and matching extensions accepted', () => {
  const fixtures = [
    ['pdf', 'application/pdf', [37,80,68,70,45]], ['jpeg', 'image/jpeg', [255,216,255]],
    ['png', 'image/png', [137,80,78,71,13,10,26,10]], ['webp', 'image/webp', [82,73,70,70,0,0,0,0,87,69,66,80]],
  ];
  for (const [ext, type, bytes] of fixtures) assert.equal(storage.documentFileError({ name: `file.${ext}`, type, size: 100 }, new Uint8Array(bytes)), null);
});
await check('forged signatures, truncated headers, HTML/SVG and extension/MIME mismatches rejected', () => {
  for (const header of [[], [137,80,78,71], [60,104,116,109,108]]) {
    assert.match(storage.documentFileError({ name: 'fake.pdf', type: 'application/pdf', size: 100 }, new Uint8Array(header)), /contents/);
  }
  for (const file of [{ name:'x.svg',type:'image/svg+xml',size:10 }, { name:'x.html',type:'text/html',size:10 }, { name:'x.pdf',type:'image/png',size:10 }]) {
    assert.ok(storage.documentFileError(file));
  }
  assert.ok(storage.documentFileError({ name:'x.webp', type:'image/webp', size:12 }, new Uint8Array([82,73,70,70,0,0,0,0,78,79,80,69])));
});
await check('zero/oversized files rejected; exactly 15 MB accepted', () => {
  const file = { name: 'test.pdf', type: 'application/pdf', size: storage.MAX_DOCUMENT_BYTES };
  assert.equal(storage.documentFileError(file), null);
  assert.match(storage.documentFileError({ ...file, size: 20 * 1024 * 1024 }), /15 MB/);
  assert.ok(storage.documentFileError({ ...file, size: 0 }));
});
await check('filenames strip paths/control characters; 120-character bound keeps the extension', () => {
  assert.equal(storage.sanitizeDocumentFileName('C:\\fakepath\\my warranty.PDF'), 'my-warranty.pdf');
  for (const value of ['../../manual.pdf', '\u0000../quote\n.pdf', 'équipement.pdf', '..\\..\\evil.pdf', `${'a'.repeat(400)}.webp`, '.pdf', '你好.pdf']) {
    const name = storage.sanitizeDocumentFileName(value);
    assert.ok(name.length <= 120); assert.match(name, /^[A-Za-z0-9][A-Za-z0-9._-]*\.(pdf|webp)$/);
  }
});
await check('storage path validation refuses foreign prefixes, traversal and non-UUID keys', () => {
  assert.ok(storage.isDocumentStoragePath(path, A, E));
  for (const value of [path.replace(A, E), `${path}/more`, `${A}/${E}/../file.pdf`, `${A}/${E}/file.pdf`, null]) assert.equal(storage.isDocumentStoragePath(value, A, E), false);
});
await check('metadata validation and strict public document allowlist fail closed', () => {
  assert.ok(documentSchema.safeParse({ name:'Warranty', type:'Warranty', visibility:'Private' }).success);
  for (const change of [{ name:'' }, { name:'x'.repeat(201) }, { type:'HTML' }, { visibility:'Everyone' }]) {
    assert.equal(documentSchema.safeParse({ name:'Warranty', type:'Warranty', visibility:'Private', ...change }).success, false);
  }
  const publicDoc = { id:D, name:'Warranty', type:'Warranty' };
  assert.ok(publicDocumentsSchema.safeParse([publicDoc]).success);
  for (const extra of [{ storage_path:path }, { private_notes:'SECRET' }, { company_id:A }, { visibility:'Private' }]) assert.equal(publicDocumentsSchema.safeParse([{ ...publicDoc, ...extra }]).success, false);
  assert.equal(publicDocumentsSchema.safeParse([{ ...publicDoc, id:'invalid' }]).success, false);
});

function fakeClient(options = {}) {
  const calls = { queries: [], uploads: [], removes: [], signs: [] };
  return {
    calls,
    from(table) {
      const query = { table, operation:'select', filters:[] };
      const answer = () => {
        calls.queries.push(query);
        if (query.operation === 'insert') return { data:options.insertError ? null : { id:D }, error:options.insertError ?? null };
        if (query.operation === 'delete') return { error:options.deleteError ?? null };
        if (query.operation === 'update') return { data:{ id:D }, error:null };
        if (table === 'equipment') return { data:options.noEquipment ? null : { id:E }, error:null };
        return { data:options.noDocument ? null : {
          company_id:A, equipment_id:E, visibility:'Public', storage_path:path, file_name:'warranty.pdf',
          equipment:{ public_token:T, status:'Active', company_id:A }, ...options.document,
        }, error:options.lookupError ?? null };
      };
      const chain = {
        select(columns) { query.columns = columns; return chain; },
        eq(key, value) { query.filters.push([key, value]); return chain; },
        insert(data) { query.operation = 'insert'; query.data = data; return chain; },
        update(data) { query.operation = 'update'; query.data = data; return chain; },
        delete() { query.operation = 'delete'; return chain; },
        single:async () => answer(), maybeSingle:async () => answer(),
        then: (resolve, reject) => Promise.resolve(answer()).then(resolve, reject),
      };
      return chain;
    },
    storage: { from(bucket) { assert.equal(bucket, 'documents'); return {
      upload:async (...args) => { calls.uploads.push(args); return { error:null }; },
      remove:async (paths) => { calls.removes.push(paths); return { error:options.removeError ?? null }; },
      createSignedUrl:async (...args) => { calls.signs.push(args); return { data:{ signedUrl:'https://storage.example.test/signed' }, error:options.signError ?? null }; },
    }; } },
  };
}
function actions(client) {
  return load('src/app/dashboard/documents/actions.ts', {
    '@/lib/session': { requireUser:async () => ({ id:D }), getUserMembership:async () => ({ companyId:A, role:'owner' }) },
    '@/lib/supabase/server': { getSupabaseServerClient:() => client },
    'next/cache': { revalidatePath() {} }, 'next/navigation': { redirect:() => { throw Error('redirect'); } },
  });
}
function form(file = pdf, visibility = 'Private') {
  const value = new FormData();
  for (const [key, data] of Object.entries({ name:'Warranty', type:'Warranty', visibility, equipment_id:E, company_id:'forged' })) value.set(key, data);
  value.set('file', file); return value;
}
await check('upload derives tenant, uses collision-resistant private key, never writes file_url', async () => {
  const client = fakeClient(); const result = await actions(client).uploadDocument(form());
  assert.equal(result.ok, true); assert.equal(client.calls.uploads.length, 1);
  assert.ok(storage.isDocumentStoragePath(client.calls.uploads[0][0], A, E));
  const row = client.calls.queries.find(q => q.operation === 'insert').data;
  assert.equal(row.company_id, undefined); assert.equal(row.file_url, undefined);
  assert.deepEqual(client.calls.queries[0].filters, [['id', E], ['company_id', A]]);
});
await check('cross-tenant equipment, fake signatures and unconfirmed public uploads never reach storage', async () => {
  for (const [options, file, visibility] of [
    [{ noEquipment:true }, pdf, 'Private'], [{}, new File(['<html>fake</html>'], 'fake.pdf', { type:'application/pdf' }), 'Private'], [{}, pdf, 'Public'],
  ]) {
    const client = fakeClient(options);
    assert.equal((await actions(client).uploadDocument(form(file, visibility))).ok, false);
    assert.equal(client.calls.uploads.length, 0);
  }
});
await check('failed document insert removes uploaded object; failed compensation is reported', async () => {
  for (const removeError of [null, { message:'cleanup denied' }]) {
    const client = fakeClient({ insertError:{ message:'insert denied' }, removeError });
    const old = console.error; console.error = () => {};
    let result;
    try { result = await actions(client).uploadDocument(form()); } finally { console.error = old; }
    assert.equal(result.ok, false); assert.equal(client.calls.removes.length, 1);
    assert.equal(client.calls.removes[0][0], client.calls.uploads[0][0]);
    assert.match(result.error, removeError ? /cleanup failed/ : /temporary upload was removed/);
  }
});
await check('delete storage failure preserves row; row failure explains retryable partial cleanup', async () => {
  let client = fakeClient({ removeError:{ message:'denied' } });
  let result = await actions(client).deleteDocument(D);
  assert.equal(result.ok, false); assert.equal(client.calls.queries.filter(q => q.operation === 'delete').length, 0);
  client = fakeClient({ deleteError:{ message:'denied' } }); result = await actions(client).deleteDocument(D);
  assert.equal(result.ok, false); assert.match(result.error, /stored file was removed.*Retry Delete/);
});
await check('dashboard downloads sign for 300 seconds; foreign path never signed; visibility changes require confirmation', async () => {
  let client = fakeClient(); assert.equal((await actions(client).downloadDocument(D)).ok, true);
  assert.equal(client.calls.signs[0][1], 300);
  client = fakeClient({ document:{ storage_path:path.replace(A, E) } });
  assert.equal((await actions(client).downloadDocument(D)).ok, false); assert.equal(client.calls.signs.length, 0);
  client = fakeClient(); assert.equal((await actions(client).updateDocument(D, form())).ok, false);
  const confirmed = form(); confirmed.set('confirm_visibility', 'yes');
  assert.equal((await actions(client).updateDocument(D, confirmed)).ok, true);
});
function route(client) {
  return load('src/app/p/[token]/documents/[documentId]/route.ts', {
    '@/lib/supabase/admin': { getSupabaseAdminClient:() => client },
    '@/lib/public/get-unitpass': { isUnitPassToken:(s) => /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s) },
  }).GET;
}
await check('public route: private, wrong token, foreign path, missing and malformed ids all return plain no-store 404, never sign', async () => {
  for (const options of [{ document:{ visibility:'Private' } }, { document:{ equipment:{ public_token:E, status:'Active', company_id:A } } },
    { document:{ storage_path:path.replace(A, E) } }, { noDocument:true }, { lookupError:{ message:'failed' } }]) {
    const client = fakeClient(options); const response = await route(client)(new Request('http://unitpass.test'), { params:{ token:T, documentId:D } });
    assert.equal(response.status, 404); assert.equal(await response.text(), 'Not found'); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(client.calls.signs.length, 0);
  }
  const client = fakeClient(); assert.equal((await route(client)(new Request('http://unitpass.test'), { params:{ token:'bad', documentId:D } })).status, 404);
  assert.equal(client.calls.queries.length, 0);
});
await check('public route: active AND replaced history use no-store 307 and <=5-minute attachment links', async () => {
  for (const status of ['Active', 'Replaced']) {
    const client = fakeClient({ document:{ equipment:{ public_token:T, status, company_id:A } } });
    const response = await route(client)(new Request('http://unitpass.test'), { params:{ token:T.toUpperCase(), documentId:D } });
    assert.equal(response.status, 307); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(client.calls.signs[0][1], 300); assert.deepEqual(client.calls.signs[0][2], { download:'warranty.pdf' });
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  }
});
console.log(`\nALL PASSED: ${checks.length} document checks (mocked I/O; live Storage verification still required)`);
