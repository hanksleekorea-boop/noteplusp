const VERSION = "noteplus-cloud-v1";
const FIREBASE_VERSION = "12.16.0";
const config = window.NOTEPLUS_FIREBASE_CONFIG;

let current = {
  version: VERSION,
  phase: "loading",
  configured: false,
  user: null,
  message: "Google 연결 설정을 확인 중입니다."
};
let auth = null;
let storage = null;
let api = null;

function publicUser(user) {
  return user ? {uid: user.uid, email: user.email || "", displayName: user.displayName || ""} : null;
}

function emit(patch) {
  current = Object.assign({}, current, patch);
  window.dispatchEvent(new CustomEvent("noteplus-cloud-state", {detail: Object.assign({}, current)}));
}

function validConfig(value) {
  return !!(value && typeof value === "object" && value.apiKey && value.authDomain && value.projectId && value.storageBucket && value.appId);
}

async function sha256(blob) {
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function uploadAndVerify(reference, blob, metadata, onProgress) {
  const task = api.uploadBytesResumable(reference, blob, metadata);
  await new Promise((resolve, reject) => task.on("state_changed", snapshot => {
    if (onProgress) onProgress(snapshot.bytesTransferred, snapshot.totalBytes);
  }, reject, resolve));
  const saved = await api.getMetadata(reference);
  const expectedHash = String(metadata.customMetadata && metadata.customMetadata.sha256 || "").toUpperCase();
  const savedHash = String(saved.customMetadata && saved.customMetadata.sha256 || "").toUpperCase();
  if (Number(saved.size) !== blob.size || (expectedHash && savedHash !== expectedHash)) {
    throw new Error("업로드 검증 불일치");
  }
  return saved;
}

async function verifyJson(reference, expectedHash, maxSize) {
  const bytes = await api.getBytes(reference, maxSize);
  const actualHash = await sha256(new Blob([bytes]));
  if (actualHash !== expectedHash) throw new Error("클라우드 JSON 검증 불일치");
}

async function uploadSnapshot(payload) {
  if (!auth || !storage || !auth.currentUser) throw new Error("Google 로그인이 필요합니다.");
  if (!payload || !/^[a-z0-9_-]{10,80}$/i.test(payload.snapshotId || "")) throw new Error("백업 식별자가 올바르지 않습니다.");
  if (!Array.isArray(payload.attachments) || typeof payload.manifestText !== "string") throw new Error("백업 묶음이 올바르지 않습니다.");
  const uid = auth.currentUser.uid;
  const base = `users/${uid}/snapshots/${payload.snapshotId}`;
  let completed = 0;
  emit({phase: "uploading", message: `첨부 업로드 0 / ${payload.attachments.length}`});

  for (const item of payload.attachments) {
    if (!item || !/^att_[a-z0-9_-]{6,100}$/i.test(item.id || "") || !(item.blob instanceof Blob)) throw new Error("첨부 묶음 검증 실패");
    const reference = api.ref(storage, `${base}/attachments/${item.id}`);
    await uploadAndVerify(reference, item.blob, {
      contentType: item.mime || "application/octet-stream",
      customMetadata: {sha256: item.sha256, snapshotId: payload.snapshotId}
    });
    completed += 1;
    emit({phase: "uploading", message: `첨부 업로드 ${completed} / ${payload.attachments.length}`});
  }

  const manifestBlob = new Blob([payload.manifestText], {type: "application/json"});
  const manifestRef = api.ref(storage, `${base}/manifest.json`);
  emit({phase: "verifying", message: "노트 목록을 업로드하고 검증 중입니다."});
  await uploadAndVerify(manifestRef, manifestBlob, {
    contentType: "application/json",
    customMetadata: {sha256: payload.manifestSha256, snapshotId: payload.snapshotId}
  });
  await verifyJson(manifestRef, payload.manifestSha256, manifestBlob.size + 1);

  const pointer = {
    format: "noteplusp-cloud-current-v1",
    snapshotId: payload.snapshotId,
    manifestPath: `${base}/manifest.json`,
    manifestSha256: payload.manifestSha256,
    noteCount: payload.counts.noteCount,
    attachmentCount: payload.counts.attachmentCount,
    committedAt: new Date().toISOString()
  };
  const pointerBlob = new Blob([JSON.stringify(pointer)], {type: "application/json"});
  const pointerHash = await sha256(pointerBlob);
  const pointerRef = api.ref(storage, `users/${uid}/current.json`);
  emit({phase: "committing", message: "검증된 백업을 현재 백업으로 확정 중입니다."});
  await uploadAndVerify(pointerRef, pointerBlob, {contentType: "application/json", customMetadata: {sha256: pointerHash}});
  await verifyJson(pointerRef, pointerHash, 64 * 1024);
  emit({phase: "ready", message: `클라우드 백업 완료 · 노트 ${payload.counts.noteCount}개 · 첨부 ${payload.counts.attachmentCount}개`});
  return pointer;
}

window.noteplusCloud = {
  status: () => Object.assign({}, current),
  signIn: async () => {
    if (!auth) throw new Error(current.message || "Google 연결 설정이 필요합니다.");
    const provider = new api.GoogleAuthProvider();
    provider.setCustomParameters({prompt: "select_account"});
    const result = await api.signInWithPopup(auth, provider);
    return publicUser(result.user);
  },
  signOut: async () => {
    if (auth) await api.signOut(auth);
  },
  uploadSnapshot
};

if (!validConfig(config)) {
  emit({phase: "unconfigured", configured: false, message: "Google 클라우드 설정 전입니다. 로컬 저장과 편집은 계속 안전하게 사용할 수 있습니다."});
} else {
  try {
    const [appModule, authModule, storageModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-storage.js`)
    ]);
    api = Object.assign({}, authModule, storageModule);
    const app = appModule.initializeApp(config);
    auth = authModule.getAuth(app);
    storage = storageModule.getStorage(app);
    await authModule.setPersistence(auth, authModule.browserLocalPersistence);
    authModule.onAuthStateChanged(auth, user => emit({
      phase: "ready",
      configured: true,
      user: publicUser(user),
      message: user ? "Google 계정이 연결되었습니다. 백업 버튼을 눌러야 데이터가 전송됩니다." : "Google 로그인 후 명시적으로 클라우드 백업을 시작할 수 있습니다."
    }), error => emit({phase: "error", configured: true, message: `로그인 상태 확인 실패: ${error.message || error}`}));
  } catch (error) {
    emit({phase: "error", configured: true, message: `Google 연결 실패. 로컬 데이터는 유지됩니다: ${error.message || error}`});
  }
}
