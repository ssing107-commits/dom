import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const app = (() => {
  if (getApps().length > 0) return getApps()[0]!;
  if (typeof window !== "undefined") {
    const missing = Object.entries(firebaseConfig)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (missing.length > 0) {
      // 개발자가 빠르게 원인을 알 수 있도록 런타임에서만 경고합니다.
      // (빌드 단계에서 예외로 실패시키면 Vercel/로컬 빌드 디버깅이 어려워질 수 있음)
      console.warn(
        `[Dorm Manager] Firebase 환경변수가 누락되었습니다: ${missing.join(", ")}`
      );
    }
  }
  return initializeApp(firebaseConfig);
})();

export const auth = getAuth(app);
export const db = getFirestore(app);

