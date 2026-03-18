import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  // For now, default to English — the client-side LanguageProvider
  // overrides this with the user's saved preference
  const locale = "en";

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
