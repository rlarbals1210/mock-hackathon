/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_KAKAOMAP_API_KEY: string;
  /** "1"이면 매칭 API를 호출하지 않고 src/lib/mock.ts의 고정 응답을 씁니다. */
  readonly VITE_USE_MOCK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
