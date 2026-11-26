import React, { useEffect, useRef } from 'react';

export default function TurnstileWidget({ siteKey, onVerify, onExpire, onError, resetSignal }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const scriptId = 'cf-turnstile-script';
    let script = document.getElementById(scriptId);

    const renderWidget = () => {
      if (!isMounted || !window.turnstile || !containerRef.current) return;

      // Clean up previous widget instance if any
      if (widgetIdRef.current !== null) {
        try {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        } catch (e) {
          // ignore
        }
      }

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey || '0x4AAAAAAGTvoqsC6gfPnUJn',
          theme: 'light',
          callback: (token) => {
            if (isMounted && onVerify) onVerify(token);
          },
          'expired-callback': () => {
            if (isMounted && onExpire) onExpire();
          },
          'error-callback': (code) => {
            if (isMounted && onError) onError(code);
          },
        });
      } catch (err) {
        console.warn('Turnstile render warning:', err);
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.turnstile) renderWidget();
      };
      document.head.appendChild(script);
    } else {
      if (window.turnstile) {
        renderWidget();
      } else {
        script.addEventListener('load', renderWidget);
      }
    }

    return () => {
      isMounted = false;
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        } catch (e) {
          // ignore
        }
      }
    };
  }, [siteKey, resetSignal]);

  return <div ref={containerRef} className="flex justify-center my-3" />;
}
