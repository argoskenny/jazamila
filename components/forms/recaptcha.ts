type RecaptchaWindow = Window & {
  grecaptcha?: {
    ready: (callback: () => void) => void;
    execute: (siteKey: string, options: { action: string }) => Promise<string>;
  };
};

let scriptPromise: Promise<void> | null = null;

function siteKey(): string {
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";
}

function loadRecaptchaScript(key: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as RecaptchaWindow).grecaptcha) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("reCAPTCHA script failed to load"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function executeRecaptcha(action: string): Promise<string> {
  const key = siteKey();
  if (!key) return "";

  await loadRecaptchaScript(key);

  return new Promise((resolve, reject) => {
    const grecaptcha = (window as RecaptchaWindow).grecaptcha;
    if (!grecaptcha) {
      reject(new Error("reCAPTCHA is unavailable"));
      return;
    }

    grecaptcha.ready(() => {
      grecaptcha.execute(key, { action }).then(resolve, reject);
    });
  });
}
