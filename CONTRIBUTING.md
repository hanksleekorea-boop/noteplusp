# 기여 안내

1. `main`에 직접 올리지 않고 별도 작업 갈래를 사용한다.
2. 원본 버전 파일을 덮어쓰지 않고 새 버전으로 분리한다.
3. 빠른 검사를 실행하고, 관련 범위가 넓으면 전체 검사를 실행한다.
4. 실제 기기·실데이터·Drive 쓰기 결과와 합성 검사를 구분한다.
5. PR에는 사용자 영향, 변경 파일, 검사 결과, 남은 한계를 적는다.

빠른 검사:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\github_quick_check.ps1
```

전체 안전 검사:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\github_full_check.ps1
```

