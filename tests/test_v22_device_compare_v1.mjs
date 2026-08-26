import assert from 'node:assert/strict';
import {summarizeExport} from '../tools/compare_device_export_v22.mjs';
const source={schema:5,notes:[{id:'note',title:'synthetic',body:'text',tags:['a'],attachmentIds:['att']}],trash:[],notebooks:[],preferences:{retained:true},attachments:[{id:'att',noteId:'note',name:'test.bin',mime:'application/octet-stream',size:3,dataBase64:'YWJj'}]};
assert.equal(summarizeExport(source).digest,summarizeExport(structuredClone(source)).digest);
const changed=structuredClone(source);changed.notes[0].body='changed';assert.notEqual(summarizeExport(source).digest,summarizeExport(changed).digest);
const corrupt=structuredClone(source);corrupt.attachments[0].size=4;assert.throws(()=>summarizeExport(corrupt));
const missing=structuredClone(source);missing.attachments=[];assert.throws(()=>summarizeExport(missing));
console.log('PASS device-export comparison synthetic equal, changed body, size mismatch, missing attachment; no real device evidence');
