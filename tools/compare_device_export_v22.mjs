import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
export function summarizeExport(bundle){
 if(bundle.schema!==5||!Array.isArray(bundle.notes)||!Array.isArray(bundle.trash)||!Array.isArray(bundle.attachments))throw new Error('Expected complete schema-5 JSON export');
 const ids=new Set(),attachments=[];
 for(const item of bundle.attachments){if(!item||typeof item.id!=='string'||ids.has(item.id)||typeof item.dataBase64!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(item.dataBase64))throw new Error('Invalid attachment');ids.add(item.id);const bytes=Buffer.from(item.dataBase64,'base64'),actual=hash(bytes);if(bytes.length!==item.size||(item.sha256&&actual!==item.sha256.toLowerCase()))throw new Error('Attachment integrity mismatch');attachments.push({id:item.id,noteId:item.noteId,name:item.name,mime:item.mime,size:bytes.length,sha256:actual});}
 const notes=bundle.notes.concat(bundle.trash);if(new Set(notes.map(n=>n.id)).size!==notes.length)throw new Error('Duplicate note');for(const n of notes)for(const id of n.attachmentIds||[])if(!ids.has(id))throw new Error('Missing attachment');
 const preferences={...(bundle.preferences||{})};delete preferences.snapshots;delete preferences.conflictVaultV1;
 const payload={notes:bundle.notes,trash:bundle.trash,notebooks:bundle.notebooks,theme:bundle.theme,preferences,attachments:attachments.sort((a,b)=>a.id.localeCompare(b.id))};
 return {notes:bundle.notes.length,trash:bundle.trash.length,attachments:attachments.length,bytes:attachments.reduce((n,a)=>n+a.size,0),digest:hash(JSON.stringify(stable(payload))),scope:'Exact note IDs/content/order, tags, dates, links, theme, ordinary preferences, attachment bytes. Recovery snapshots/conflict vault and import audit reports excluded; legitimate ID remapping requires separate review.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==4)throw new Error('Usage: node tools/compare_device_export_v22.mjs <PC-export.json> <Android-export.json>');const left=summarizeExport(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))),right=summarizeExport(JSON.parse(fs.readFileSync(process.argv[3],'utf8')));console.log(JSON.stringify({match:left.digest===right.digest,left,right,personalContentPrinted:false},null,2));if(left.digest!==right.digest)process.exitCode=1;}catch(error){console.error('COMPARISON_BLOCKED: '+error.message);process.exitCode=2;}
}
