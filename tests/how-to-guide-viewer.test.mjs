import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function importTypeScriptModule(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });

  const encodedModule = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  return import(encodedModule);
}

const {
  DEFAULT_HOW_TO_GUIDES,
  POLICY_ID_NAMES,
  findGuideBySlugOrId,
  isMethodBasedGuide
} = await importTypeScriptModule('../src/lib/howToGuides.ts');

test('isMethodBasedGuide identifies method-based vs flat guides correctly', () => {
  assert.equal(isMethodBasedGuide(null), false);
  assert.equal(isMethodBasedGuide(undefined), false);
  assert.equal(isMethodBasedGuide([]), false);

  const leaveGuide = findGuideBySlugOrId('how-to-apply-leave');
  assert.equal(isMethodBasedGuide(leaveGuide), false, 'Leave guide has flat steps');
  assert.equal(isMethodBasedGuide(leaveGuide.steps), false, 'Array of flat steps returns false');

  const taskGuide = findGuideBySlugOrId('how-to-submit-task');
  assert.equal(isMethodBasedGuide(taskGuide), true, 'Task guide has method-based steps');
  assert.equal(isMethodBasedGuide(taskGuide.steps), true, 'Array of method steps returns true');
});

test('findGuideBySlugOrId resolves both by exact slug and id', () => {
  const bySlug = findGuideBySlugOrId('how-to-apply-leave');
  assert.ok(bySlug, 'Must find guide by slug');
  assert.equal(bySlug.slug, 'how-to-apply-leave');
  assert.equal(bySlug.title, 'How to Apply for Leave');

  const byTaskSlug = findGuideBySlugOrId('how-to-submit-task');
  assert.ok(byTaskSlug, 'Must find guide by task slug');
  assert.equal(byTaskSlug.slug, 'how-to-submit-task');
  assert.equal(byTaskSlug.related_policy_id, null, 'Task guide must have no policy linkage');

  const notFound = findGuideBySlugOrId('non-existent-slug');
  assert.equal(notFound, null, 'Returns null for unknown slug');
});

test('findGuideBySlugOrId custom guides list support', () => {
  const customList = [
    {
      id: 'custom-uuid-1',
      slug: 'how-to-tune-flute',
      title: 'How to Use the Flute Tuner',
      description: 'Learn how to tune your bansuri',
      steps: [{ order: 1, text: 'Open Flute Tuner' }],
      related_policy_id: null,
      display_order: 3,
      is_active: true
    }
  ];

  const found = findGuideBySlugOrId('how-to-tune-flute', customList);
  assert.ok(found);
  assert.equal(found.id, 'custom-uuid-1');

  const foundById = findGuideBySlugOrId('custom-uuid-1', customList);
  assert.ok(foundById);
  assert.equal(foundById.slug, 'how-to-tune-flute');
});

test('Policy naming mapping strictly handles all 5 canonical policy IDs', () => {
  const canonicalIds = ['conduct', 'attendance', 'fees', 'ip', 'progress'];
  for (const id of canonicalIds) {
    assert.ok(POLICY_ID_NAMES[id], `Policy ID '${id}' must have a valid title`);
    assert.ok(typeof POLICY_ID_NAMES[id] === 'string');
    assert.ok(POLICY_ID_NAMES[id].length > 0);
  }
});
