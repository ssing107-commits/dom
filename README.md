# Dorm Manager (기숙사 관리)

기술 스택: **Next.js 14(App Router) + TypeScript + Tailwind CSS + Firebase Auth/Firestore + Vercel**

## 로컬 실행

```bash
cd dorm-manager
npm install
```

1) `.env.local` 생성

`.env.local.example`을 복사해서 `.env.local`로 만들고 Firebase 값들을 채워주세요.

2) 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속 후 `/login`에서 로그인합니다.

## Firebase 설정

### Authentication
- **이메일/비밀번호** 제공자 활성화
- 앱에서 미로그인 사용자는 보호 페이지 접근 시 **`/login`으로 리다이렉트** 됩니다.

### Firestore 컬렉션
- `dormitories`
- `residents`
- `moveRecords`
- `maintenanceRecords`

## Firestore 보안 규칙(예시)

요구사항: **Firebase Auth로 로그인한 사용자만 read/write 허용**

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 코드 구조

- `src/lib/firebase.ts`: Firebase 초기화(환경변수 기반)
- `src/lib/firestore/*`: Firestore 쿼리 함수 모음(화면에서 직접 쿼리 금지)
- `src/app/login/page.tsx`: 로그인
- `src/app/(protected)/dashboard/page.tsx`: 대시보드
- `src/app/(protected)/dormitory/[id]/page.tsx`: 기숙사 상세(탭)
- `src/components/ui/*`: 공통 UI(모달/토스트/스켈레톤 등)

## Vercel 배포

1) GitHub에 푸시
2) Vercel에서 Import
3) Project Settings → Environment Variables에 아래 값들 추가
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`

`vercel.json`은 기본 Next.js 프레임워크 설정을 포함합니다.

