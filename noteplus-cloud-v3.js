const VERSION = "noteplus-cloud-v3";
const FIREBASE_VERSION = "12.16.0";
const config = window.NOTEPLUS_FIREBASE_CONFIG;
const REDIRECT_PENDING_KEY = "noteplus_google_redirect_pending_v1";

function isMobileLike() {
  try {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "") || Number(navigator.maxTouchPoints || 0) > 1 || Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  } catch { return false; }
}

function preferredSignInStrategy() {
  return isMobileLike() && config && config.mobileAuthMode === "redirect" ? "redirect" : "popup";
}

function readRedirectPending() {
  try { return sessionStorage.getItem(REDIRECT_PENDING_KEY) === "1"; }
  catch { return false; }
}

function writeRedirectPending(value) {
  try { if (value) sessionStorage.setItem(REDIRECT_PENDING_KEY, "1"); else sessionStorage.removeItem(REDIRECT_PENDING_KEY); }
  catch { /* 인증 보조 저장소 실패가 로컬 노트 기능을 막지 않게 한다. */ }
}

let current = {
  version: VERSION,
  phase: "loading",
  configured: false,
  user: null,
  mobile: isMobileLike(),
  signInStrategy: preferredSignInStrategy(),
  message: "Google 연결 설정을 확인 중입니다."
};
let auth = null;
let storage = null;
let api = null;
let phaseBeforeOffline = "loading";

function publicUser(user) {
  return user ? {uid: user.uid, email: user.email || "", displayName: user.displayName || ""} : null;
}

function emit(patch) {
  current = Object.assign({}, current, patch);
  window.dispatchEvent(new CustomEvent("noteplus-cloud-state", {detail: Object.assign({}, current)}));
}

function validConfig(value) {
  if (!value || typeof value !== "object") return false;
  const fields = ["apiKey", "authDomain", "projectId", "storageBucket", "appId"];
  if (!fields.every(key => typeof value[key] === "string" && value[key].trim() && !/YOUR_|REPLACE|CHANGE_ME/i.test(value[key]))) return false;
  return /^[a-z0-9.-]+$/i.test(value.authDomain) && /^[a-z0-9._:-]+$/i.test(value.projectId) && /^[a-z0-9._-]+\.(appspot\.com|firebasestorage\.app)$/i.test(value.storageBucket);
}

function friendlyError(error) {
  const code = String(error && error.code || "");
  if (/popup-closed-by-user|cancelled-popup-request/.test(code)) return "Google 로그인이 취소되었습니다. 로컬 데이터는 그대로입니다.";
  if (/popup-blocked/.test(code)) return "브라우저가 로그인 창을 차단했습니다. 팝업을 허용한 뒤 다시 시도하세요.";
  if (/unauthorized-domain/.test(code)) return "이 공개 주소가 Firebase 승인 도메인에 등록되지 않았습니다. 로컬 데이터는 그대로입니다.";
  if (/web-storage-unsupported|operation-not-supported-in-this-environment/.test(code)) return "이 브라우저에서는 Google 로그인 상태를 유지할 수 없습니다. 일반 Chrome 또는 Safari에서 다시 시도하세요. 로컬 데이터는 그대로입니다.";
  if (/missing-initial-state|redirect-cancelled-by-user/.test(code)) return "Google 로그인 복귀 정보를 확인하지 못했습니다. 다시 로그인해도 로컬 데이터에는 영향이 없습니다.";
  if (/network-request-failed|retry-limit-exceeded/.test(code) || !navigator.onLine) return "네트워크 연결을 확인하세요. 로컬 데이터와 이전 백업은 그대로입니다.";
  if (/unauthorized|permission-denied/.test(code)) return "이 Google 계정에는 해당 백업 경로 권한이 없습니다.";
  if (/object-not-found/.test(code)) return "이 계정에서 완성된 클라우드 백업을 찾지 못했습니다.";
  if (/quota-exceeded/.test(code)) return "클라우드 저장공간 한도를 확인하세요. 로컬 데이터는 그대로입니다.";
  return String(error && error.message || error || "알 수 없는 Google 오류");
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

function requireUser() {
  if (!auth || !storage || !auth.currentUser) throw new Error("Google 로그인이 필요합니다.");
  return auth.currentUser;
}

function validSnapshotId(value) {
  return /^[a-z0-9_-]{10,80}$/i.test(String(value || ""));
}

async function downloadVerifiedJson(reference, maxBytes, expectedHash) {
  const metadata = await api.getMetadata(reference);
  const size = Number(metadata.size);
  if (!Number.isFinite(size) || size < 2 || size > maxBytes) throw new Error("클라우드 JSON 크기가 안전 범위를 벗어났습니다.");
  const bytes = await api.getBytes(reference, size + 1);
  const actualHash = await sha256(new Blob([bytes]));
  const metadataHash = String(metadata.customMetadata && metadata.customMetadata.sha256 || "").toUpperCase();
  if (expectedHash && actualHash !== expectedHash) throw new Error("클라우드 JSON SHA-256 불일치");
  if (metadataHash && actualHash !== metadataHash) throw new Error("클라우드 JSON 메타데이터 불일치");
  let value;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error("클라우드 JSON을 해석할 수 없습니다."); }
  return {value, sha256: actualHash, size};
}

async function downloadCurrentSnapshot() {
  const user = requireUser();
  emit({phase: "downloading", message: "현재 클라우드 백업 정보를 검증 중입니다."});
  const pointerRef = api.ref(storage, `users/${user.uid}/current.json`);
  const pointerResult = await downloadVerifiedJson(pointerRef, 64 * 1024, "");
  const pointer = pointerResult.value;
  if (!pointer || pointer.format !== "noteplusp-cloud-current-v1" || !validSnapshotId(pointer.snapshotId) || !/^[A-F0-9]{64}$/.test(String(pointer.manifestSha256 || ""))) throw new Error("현재 백업 포인터 형식이 올바르지 않습니다.");
  const expectedPath = `users/${user.uid}/snapshots/${pointer.snapshotId}/manifest.json`;
  if (pointer.manifestPath !== expectedPath) throw new Error("백업 경로의 계정 소유권 검증에 실패했습니다.");
  const manifestRef = api.ref(storage, expectedPath);
  const manifestResult = await downloadVerifiedJson(manifestRef, 512 * 1024 * 1024, pointer.manifestSha256);
  const manifest = manifestResult.value;
  if (!manifest || manifest.format !== "noteplusp-cloud-snapshot-v1" || Number(manifest.schema) !== 5 || manifest.snapshotId !== pointer.snapshotId || !manifest.state || !Array.isArray(manifest.attachments)) throw new Error("클라우드 manifest 형식이 올바르지 않습니다.");
  emit({phase: "ready", message: `복원 미리보기 준비 · 노트 ${Number(manifest.counts && manifest.counts.noteCount) || 0}개 · 첨부 ${manifest.attachments.length}개`});
  return {pointer, manifest, manifestSize: manifestResult.size, accountUid: user.uid};
}

async function downloadAttachment(snapshotId, descriptor, accountUid) {
  const user = requireUser();
  if (accountUid && user.uid !== accountUid) throw new Error("복원 확인 후 Google 계정이 변경되어 안전하게 중단했습니다.");
  if (!validSnapshotId(snapshotId) || !descriptor || !/^att_[a-z0-9_-]{6,100}$/i.test(String(descriptor.id || "")) || !/^[A-F0-9]{64}$/.test(String(descriptor.sha256 || ""))) throw new Error("클라우드 첨부 설명이 올바르지 않습니다.");
  const reference = api.ref(storage, `users/${user.uid}/snapshots/${snapshotId}/attachments/${descriptor.id}`);
  const metadata = await api.getMetadata(reference);
  const size = Number(metadata.size), expectedSize = Number(descriptor.size);
  const metadataHash = String(metadata.customMetadata && metadata.customMetadata.sha256 || "").toUpperCase();
  if (!Number.isFinite(size) || size < 0 || size !== expectedSize) throw new Error("클라우드 첨부 크기 불일치");
  if (metadataHash !== descriptor.sha256) throw new Error("클라우드 첨부 메타데이터 SHA-256 불일치");
  const bytes = await api.getBytes(reference, size + 1);
  const blob = new Blob([bytes], {type: descriptor.mime || metadata.contentType || "application/octet-stream"});
  if (await sha256(blob) !== descriptor.sha256) throw new Error("클라우드 첨부 SHA-256 불일치");
  return blob;
}

async function uploadSnapshot(payload) {
  if (!auth || !storage || !auth.currentUser) throw new Error("Google 로그인이 필요합니다.");
  if (!payload || !/^[a-z0-9_-]{10,80}$/i.test(payload.snapshotId || "")) throw new Error("백업 식별자가 올바르지 않습니다.");
  if (!Array.isArray(payload.attachments) || typeof payload.manifestText !== "string") throw new Error("백업 묶음이 올바르지 않습니다.");
  const uid = auth.currentUser.uid;
  const base = `users/${uid}/snapshots/${payload.snapshotId}`;
  let completed = 0, completedBytes = 0;
  const totalBytes = payload.attachments.reduce((sum, item) => sum + Number(item && item.blob && item.blob.size || 0), 0) + new Blob([payload.manifestText]).size;
  emit({phase: "uploading", message: `첨부 업로드 0 / ${payload.attachments.length}`});

  for (const item of payload.attachments) {
    if (!item || !/^att_[a-z0-9_-]{6,100}$/i.test(item.id || "") || !(item.blob instanceof Blob)) throw new Error("첨부 묶음 검증 실패");
    const reference = api.ref(storage, `${base}/attachments/${item.id}`);
    await uploadAndVerify(reference, item.blob, {
      contentType: item.mime || "application/octet-stream",
      customMetadata: {sha256: item.sha256, snapshotId: payload.snapshotId}
    }, transferred => {
      const percent = totalBytes ? Math.min(99, Math.floor(((completedBytes + transferred) / totalBytes) * 100)) : 0;
      emit({phase: "uploading", message: `첨부 업로드 ${completed} / ${payload.attachments.length} · ${percent}%`});
    });
    if (!auth.currentUser || auth.currentUser.uid !== uid) throw new Error("백업 중 Google 계정이 변경되어 안전하게 중단했습니다.");
    completedBytes += item.blob.size;
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
  if (!auth.currentUser || auth.currentUser.uid !== uid) throw new Error("백업 중 Google 계정이 변경되어 현재 백업 확정을 중단했습니다.");

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
    if (!navigator.onLine) throw Object.assign(new Error("네트워크 연결을 확인하세요. 로컬 데이터는 그대로입니다."), {code: "auth/network-request-failed"});
    const provider = new api.GoogleAuthProvider();
    provider.setCustomParameters({prompt: "select_account"});
    const strategy = preferredSignInStrategy();
    emit({phase: "authenticating", mobile: isMobileLike(), signInStrategy: strategy, message: strategy === "redirect" ? "Google 로그인 화면으로 이동합니다. 돌아오면 로그인 결과를 안전하게 확인합니다." : "Google 로그인 창을 여는 중입니다. 로그인만으로는 노트가 전송되지 않습니다."});
    if (strategy === "redirect") {
      writeRedirectPending(true);
      await api.signInWithRedirect(auth, provider);
      return {redirecting: true};
    }
    const result = await api.signInWithPopup(auth, provider);
    writeRedirectPending(false);
    return publicUser(result.user);
  },
  signOut: async () => {
    writeRedirectPending(false);
    if (auth) await api.signOut(auth);
  },
  uploadSnapshot,
  downloadCurrentSnapshot,
  downloadAttachment,
  configurationStatus: () => ({configured: validConfig(config), firebaseVersion: FIREBASE_VERSION, mobile: isMobileLike(), signInStrategy: preferredSignInStrategy()}),
  friendlyError
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
    let redirectFailure = "";
    const redirectPending = readRedirectPending();
    if (redirectPending) emit({phase: "auth-returning", configured: true, message: "Google 로그인에서 돌아왔습니다. 계정 상태를 확인 중입니다."});
    try {
      const redirectResult = await authModule.getRedirectResult(auth);
      if (redirectResult && redirectResult.user) {
        writeRedirectPending(false);
        emit({phase: "ready", configured: true, user: publicUser(redirectResult.user), message: "휴대폰 Google 로그인이 완료되었습니다. 로그인만으로는 데이터가 전송되지 않습니다."});
      } else if (redirectPending) {
        writeRedirectPending(false);
        emit({phase: "ready", configured: true, user: publicUser(auth.currentUser), message: auth.currentUser ? "Google 로그인 상태를 복구했습니다. 로그인만으로는 데이터가 전송되지 않습니다." : "Google 로그인이 완료되지 않았습니다. 다시 시도해도 로컬 데이터는 그대로입니다."});
      }
    } catch (error) {
      writeRedirectPending(false);
      redirectFailure = friendlyError(error);
      emit({phase: "error", configured: true, message: `Google 로그인 복귀 확인 실패. ${redirectFailure}`});
    }
    authModule.onAuthStateChanged(auth, user => emit({
      phase: !user && redirectFailure ? "error" : "ready",
      configured: true,
      user: publicUser(user),
      mobile: isMobileLike(),
      signInStrategy: preferredSignInStrategy(),
      message: user ? "Google 계정이 연결되었습니다. 백업 버튼을 눌러야 데이터가 전송됩니다." : (redirectFailure ? `Google 로그인 복귀 확인 실패. ${redirectFailure}` : "Google 로그인 후 명시적으로 클라우드 백업을 시작할 수 있습니다.")
    }), error => emit({phase: "error", configured: true, message: `로그인 상태 확인 실패: ${friendlyError(error)}`}));
  } catch (error) {
    emit({phase: "error", configured: true, message: `Google 연결 실패. 로컬 데이터는 유지됩니다: ${friendlyError(error)}`});
  }
}

window.addEventListener("offline", () => { phaseBeforeOffline = current.phase; emit({phase: "offline", message: "오프라인입니다. 로컬 편집은 계속되며 Google 작업은 연결 후 다시 시도할 수 있습니다."}); });
window.addEventListener("online", () => emit({phase: auth ? "ready" : phaseBeforeOffline, message: auth && auth.currentUser ? "네트워크가 복구되었습니다. 로그인만으로는 데이터가 전송되지 않습니다." : (phaseBeforeOffline === "unconfigured" ? "Google 클라우드 설정 전입니다. 로컬 저장과 편집은 계속 안전하게 사용할 수 있습니다." : "네트워크가 복구되었습니다.")}));
