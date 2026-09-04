import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'noteplus-stage3-v22.js'), 'utf8');
const ctx = { console, Uint8Array, Date, JSON, Math, Number, String, Error, Promise, Set, Object, Array, parseInt, isFinite };
ctx.window = ctx;
vm.runInNewContext(source, ctx, { filename: 'noteplus-stage3-v22.js' });
const api = ctx.noteplusStage3;
assert.equal(api.localOnly, true);
assert.equal(api.VERSION, 'v22-stage3-local-contract-1');

api.reset();
const share = api.share.create({ noteId: 'n1', title: '공개 후보', body: '본문', expiresAt: Date.now() + 2 * 86400000 });
assert.equal(share.permission, 'view');
assert.equal(api.share.resolve(share.token).title, '공개 후보');
assert.equal(api.share.revoke(share.token, '사용자 회수'), true);
assert.equal(api.share.resolve(share.token), null);
assert.throws(() => api.share.create({ noteId: 'n2', body: 'x', expiresAt: Date.now() - 1 }), /만료일/);

const ai = api.ai.preview({ noteId: 'n1', title: '제목', body: '본문', fields: ['title'], allVault: false, costCents: 20 });
assert.equal(ai.networkTransmission, false);
await assert.rejects(() => api.ai.run(ai), /승인된/);
const approved = api.ai.approve(ai, { confirm: true, maxCostCents: 50 });
assert.equal(approved.approved, true);
const aiResult = await api.ai.run(approved, async payload => ({ summary: payload.title }));
assert.equal(aiResult.originalChanged, false);
assert.throws(() => api.ai.preview({ noteId: 'n1', body: 'x', allVault: true }), /전체 보관함/);

const space = api.team.createSpace({ ownerId: 'owner', name: '시험 공간' });
const invited = api.team.invite(space.spaceId, 'owner', 'viewer-1', 'viewer');
assert.equal(api.team.authorize(invited, 'viewer-1', 'viewer'), true);
assert.equal(api.team.authorize(invited, 'viewer-1', 'editor'), false);
assert.throws(() => api.team.changeRole(space.spaceId, 'viewer-1', 'viewer-1', 'editor'), /소유자/);
assert.equal(api.team.remove(space.spaceId, 'owner', 'viewer-1'), true);

assert.equal(api.i18n.missing().length, 0);
assert.equal(api.i18n.t('stage3', 'en'), 'Stage 3 extensions (test)');
const drill = api.operations.drill('share_recall');
assert.equal(drill.realIncident, false);
assert.equal(drill.steps.every(step => step.status === 'PASS'), true);
const packet = api.review.packet({ candidate: 'v22', checks: [{ id: 'a11y', status: 'NOT_RUN', owner: '미지정' }] });
assert.equal(packet.containsPersonalNotes, false);
assert.equal(packet.reviewerVerified, false);
const fields = Array.from({ length: 27 }, (_, i) => ({ id: `F${String(i + 1).padStart(2, '0')}`, weight: 1 }));
assert.equal(api.compare.manifest({ fields }).fieldCount, 27);
const gate = api.gate({});
assert.equal(gate.releaseAllowed, false);
assert.equal(gate.blockers.length, 11);
console.log(JSON.stringify({ ok: true, shareRevoked: true, aiExplicitApproval: true, teamLeastPrivilege: true, translations: 2, drillSteps: drill.steps.length, gateBlockers: gate.blockers.length }));
