import { useEffect, useRef, useState } from 'react';

type AdSlotProps = {
  slotId?: string;
  label: string;
  className?: string;
  minHeight?: number;
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    __envValidatorAdsScriptLoaded?: boolean;
  }
}

const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
const ADSENSE_SCRIPT_ID = 'env-validator-adsense-loader';

function ensureAdSenseScript(clientId: string): HTMLScriptElement {
  const existing = document.getElementById(ADSENSE_SCRIPT_ID) as HTMLScriptElement | null;

  if (existing) {
    if (typeof window.adsbygoogle !== 'undefined') {
      window.__envValidatorAdsScriptLoaded = true;
    }
    return existing;
  }

  const script = document.createElement('script');
  script.id = ADSENSE_SCRIPT_ID;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `${ADSENSE_SRC}?client=${clientId}`;
  document.head.appendChild(script);
  return script;
}

export function AdSlot({ slotId, label, className, minHeight = 120 }: AdSlotProps) {
  const clientId = import.meta.env.VITE_ADSENSE_CLIENT;
  const hasClientId =
    typeof clientId === 'string' &&
    clientId.length > 0 &&
    !clientId.includes('xxxxxxxx');
  const isConfigured =
    hasClientId &&
    typeof slotId === 'string' &&
    slotId.length > 0;
  const adInitializedRef = useRef(false);
  const [state, setState] = useState<'placeholder' | 'loading' | 'ready' | 'error'>(
    isConfigured ? 'loading' : 'placeholder',
  );

  useEffect(() => {
    if (!hasClientId || !clientId) {
      return;
    }

    try {
      const script = ensureAdSenseScript(clientId);

      if (window.__envValidatorAdsScriptLoaded || typeof window.adsbygoogle !== 'undefined') {
        window.__envValidatorAdsScriptLoaded = true;
        return;
      }

      script.addEventListener(
        'load',
        () => {
          window.__envValidatorAdsScriptLoaded = true;
        },
        { once: true },
      );
    } catch {
      // Ignore provider-load failures here; slot-level UI handles actual ad errors.
    }
  }, [clientId, hasClientId]);

  useEffect(() => {
    if (!isConfigured || !clientId || !slotId || adInitializedRef.current) {
      return;
    }

    adInitializedRef.current = true;

    try {
      const script = ensureAdSenseScript(clientId);
      const markReady = () => {
        try {
          window.adsbygoogle = window.adsbygoogle ?? [];
          window.adsbygoogle.push({});
          setState('ready');
        } catch {
          setState('error');
        }
      };

      if (window.__envValidatorAdsScriptLoaded || typeof window.adsbygoogle !== 'undefined') {
        window.__envValidatorAdsScriptLoaded = true;
        markReady();
        return;
      }

      script.addEventListener(
        'load',
        () => {
          window.__envValidatorAdsScriptLoaded = true;
          markReady();
        },
        { once: true },
      );
      script.addEventListener(
        'error',
        () => {
          setState('error');
        },
        { once: true },
      );
    } catch {
      window.setTimeout(() => {
        setState('error');
      }, 0);
    }
  }, [clientId, isConfigured, slotId]);

  return (
    <aside
      className={`ad-slot ${!isConfigured ? 'ad-slot--reserved' : ''} ${className ?? ''}`.trim()}
      style={{ minHeight }}
      aria-label={`${label} ad slot`}
    >
      <div className="ad-slot__label">Sponsored</div>
      {isConfigured ? (
        <>
          <ins
            className="adsbygoogle ad-slot__unit"
            style={{ display: 'block', minHeight }}
            data-ad-client={clientId}
            data-ad-slot={slotId}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
          <p className="ad-slot__status">
            {state === 'loading' && `${label} is loading.`}
            {state === 'ready' && `${label} is live.`}
            {state === 'error' && `${label} could not load in this session.`}
          </p>
        </>
      ) : (
        <div className="ad-slot__placeholder" aria-hidden="true">
          <span>{label}</span>
          <small>Reserved ad space</small>
        </div>
      )}
    </aside>
  );
}
