import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  // For now, default to English — the client-side LanguageProvider
  // overrides this with the user's saved preference
  const locale = "en";

  return {
    locale,
    timeZone: "Asia/Jakarta",
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Suppress ENVIRONMENT_FALLBACK warnings during SSG builds
    onError(error) {
      if (error.code === "ENVIRONMENT_FALLBACK") return;
      console.error(error);
    },
    getMessageFallback({ namespace, key }) {
      return `${namespace}.${key}`;
    },
  };
});
