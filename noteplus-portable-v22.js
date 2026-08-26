/* Dependency-free, uncompressed ZIP. Only our bounded, CRC-checked portable format is accepted. */
(function(){
 'use strict';
 const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true}),table=new Uint32Array(256);
 for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}
 const LIMIT=2*1024**3;
 function nameOK(name){return typeof name==='string'&&name.length<240&&!name.startsWith('/')&&!name.includes('\\')&&!name.includes(':')&&!name.split('/').some(s=>!s||s==='.'||s==='..')&&!/[\x00-\x1f\x7f]/.test(name);}
 async function crc(blob){let c=0xffffffff;for(let at=0;at<blob.size;at+=2*1024**2){const bytes=new Uint8Array(await blob.slice(at,at+2*1024**2).arrayBuffer());for(const b of bytes)c=table[(c^b)&255]^(c>>>8);await new Promise(done=>setTimeout(done,0));}return (c^0xffffffff)>>>0;}
 function header(size){const bytes=new Uint8Array(size),view=new DataView(bytes.buffer);return {bytes,view};}
 async function encode(files){
  if(!Array.isArray(files)||!files.length||files.length>60000)throw new Error('ZIP 파일 수 제한');
  const seen=new Set(),chunks=[],central=[];let offset=0,centralSize=0;
  for(const file of files){
   if(!nameOK(file.path)||seen.has(file.path)||!(file.blob instanceof Blob))throw new Error('ZIP 이름 또는 자료 오류');seen.add(file.path);
   const name=encoder.encode(file.path),size=file.blob.size,checksum=await crc(file.blob);if(offset+size+name.length+30>LIMIT)throw new Error('ZIP은 2GiB 이하로 나누어 주세요.');
   const h=header(30);h.view.setUint32(0,0x04034b50,true);h.view.setUint16(4,20,true);h.view.setUint16(6,0x800,true);h.view.setUint16(12,33,true);h.view.setUint32(14,checksum,true);h.view.setUint32(18,size,true);h.view.setUint32(22,size,true);h.view.setUint16(26,name.length,true);
   chunks.push(h.bytes,name,file.blob);
   const c=header(46);c.view.setUint32(0,0x02014b50,true);c.view.setUint16(4,20,true);c.view.setUint16(6,20,true);c.view.setUint16(8,0x800,true);c.view.setUint16(14,33,true);c.view.setUint32(16,checksum,true);c.view.setUint32(20,size,true);c.view.setUint32(24,size,true);c.view.setUint16(28,name.length,true);c.view.setUint32(42,offset,true);central.push(c.bytes,name);centralSize+=46+name.length;offset+=30+name.length+size;
  }
  if(offset+centralSize+22>LIMIT)throw new Error('ZIP 전체 크기는 2GiB 이하여야 합니다.');
  const end=header(22);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,files.length,true);end.view.setUint16(10,files.length,true);end.view.setUint32(12,centralSize,true);end.view.setUint32(16,offset,true);
  return new Blob([...chunks,...central,end.bytes],{type:'application/zip'});
 }
 async function decode(blob){
  if(!(blob instanceof Blob)||blob.size<22||blob.size>LIMIT)throw new Error('ZIP 크기 오류');
  const end=new DataView(await blob.slice(-22).arrayBuffer());if(end.getUint32(0,true)!==0x06054b50||end.getUint16(4,true)||end.getUint16(6,true)||end.getUint16(20,true))throw new Error('지원하지 않는 ZIP 끝 구조');
  const count=end.getUint16(10,true),size=end.getUint32(12,true),start=end.getUint32(16,true);if(!count||count>60000||size>32*1024**2||end.getUint16(8,true)!==count||start+size!==blob.size-22)throw new Error('ZIP 목록 구조 오류');
  const central=new Uint8Array(await blob.slice(start,start+size).arrayBuffer()),view=new DataView(central.buffer),files=new Map();let pos=0,expectedOffset=0;
  for(let i=0;i<count;i++){
   if(pos+46>size||view.getUint32(pos,true)!==0x02014b50)throw new Error('ZIP 목록 손상');
   const flags=view.getUint16(pos+8,true),method=view.getUint16(pos+10,true),checksum=view.getUint32(pos+16,true),length=view.getUint32(pos+20,true),unpacked=view.getUint32(pos+24,true),nameLen=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true),offset=view.getUint32(pos+42,true);
   if(flags!==0x800||method!==0||length!==unpacked||extra||comment||offset!==expectedOffset||pos+46+nameLen>size)throw new Error('허용하지 않는 ZIP 항목');
   const name=decoder.decode(central.slice(pos+46,pos+46+nameLen));if(!nameOK(name)||files.has(name))throw new Error('안전하지 않거나 중복된 경로');
   const raw=new Uint8Array(await blob.slice(offset,offset+30+nameLen).arrayBuffer()),local=new DataView(raw.buffer);
   if(raw.length!==30+nameLen||local.getUint32(0,true)!==0x04034b50||local.getUint16(6,true)!==flags||local.getUint16(8,true)!==method||local.getUint32(14,true)!==checksum||local.getUint32(18,true)!==length||local.getUint32(22,true)!==length||local.getUint16(26,true)!==nameLen||local.getUint16(28,true)!==0||decoder.decode(raw.slice(30))!==name)throw new Error('ZIP 본문/목록 불일치');
   expectedOffset=offset+30+nameLen+length;if(expectedOffset>start)throw new Error('ZIP 본문 범위 오류');
   const data=blob.slice(offset+30+nameLen,expectedOffset);if(await crc(data)!==checksum)throw new Error('ZIP 본문 지문값 불일치');files.set(name,data);pos+=46+nameLen;
  }
  if(pos!==size||expectedOffset!==start)throw new Error('ZIP 숨은 항목 차단');return files;
 }
 window.noteplusPortable={encode,decode};
}());
