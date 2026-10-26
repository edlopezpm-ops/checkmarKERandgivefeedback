import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DecorativeAssets } from './decoration/assets';
import type { PlaybackState } from './decoration/Background';
import { Console } from './console/Console';
import { Help } from './console/Help';
import { EnvironmentSettings, type EnvironmentPreferences } from './console/EnvironmentSettings';
import { useLanguage } from './i18n';
import { Policies, PolicyLinks, type PolicySection } from './console/Policies';

const Background = lazy(() => import('./decoration/Background'));
const reviewAutoplay = import.meta.env.DEV && new URLSearchParams(location.search).get('autoplay') !== '0';

export function App() {
  const { language, setLanguage, t } = useLanguage();
  const [authenticated, setAuthenticated] = useState(false);
  const [policy,setPolicy]=useState<PolicySection|undefined>(()=>{const value=new URLSearchParams(location.search).get('policy');return value==='terms'||value==='privacy'||value==='cookies'?value:undefined;});
  const preferencesMenu=useRef<HTMLDetailsElement>(null);
  function openPolicy(section:PolicySection){setPolicy(section);const url=new URL(location.href);url.searchParams.set('policy',section);history.replaceState(null,'',url);}
  function closePolicy(){setPolicy(undefined);const url=new URL(location.href);url.searchParams.delete('policy');history.replaceState(null,'',url);}
  useEffect(()=>{const show=(event:Event)=>{const section=(event as CustomEvent).detail;if(section==='terms'||section==='privacy'||section==='cookies')openPolicy(section);};window.addEventListener('marker:open-policy',show);return()=>window.removeEventListener('marker:open-policy',show);},[]);
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('marker-theme') === 'dark'; } catch { return false; } });
  useLayoutEffect(() => {
    const theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('marker-theme', theme); } catch { /* The visible theme remains usable without browser storage. */ }
  }, [dark]);
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [paused, setPaused] = useState(false);
  const [cache, setCache] = useState(false);
  const [cacheMessage, setCacheMessage] = useState('');
  const cacheRequest = useRef(0);
  const [assets] = useState(() => new DecorativeAssets());
  const [preview, setPreview] = useState<{ id: string; nonce: number }>();
  const [selection, setSelection] = useState('kungfu');
  const [playback, setPlayback] = useState<PlaybackState>({ phase: 'rest' });
  useEffect(() => { const timer = setTimeout(() => setReady(true), 150); return () => clearTimeout(timer); }, []);

  const changeAccess = useCallback((value: boolean) => {
    setAuthenticated(value);
    if (!value) {
      ++cacheRequest.current;
      setCache(false);
      setCacheMessage('');
      void assets.setConsent(false);
    }
  }, [assets]);

  async function changeCache(accepted: boolean) {
    const request = ++cacheRequest.current;
    setCache(accepted);
    setCacheMessage(accepted ? 'Preparando copia opcional…' : 'Eliminando copia opcional…');
    const message = await assets.setConsent(accepted);
    if (request === cacheRequest.current) setCacheMessage(message);
  }
  const stateLabel = !enabled ? 'Decoración desactivada' : playback.phase === 'reduced'
    ? 'Movimiento reducido · composición estática' : playback.phase === 'playing'
      ? `${playback.scene} · en movimiento` : playback.phase === 'paused'
        ? 'Animación en pausa' : '';
  const preferences: EnvironmentPreferences = {
    dark, onDark: setDark, enabled, paused, cache, cacheMessage, stateLabel, playing: playback.phase === 'playing',
    scene: playback.scene, reduced: playback.phase === 'reduced', selection,
    onEnabled: setEnabled, onPaused: setPaused, onCache: accepted => { void changeCache(accepted); },
    onSelection: setSelection, onPreview: () => setPreview({ id: selection, nonce: Date.now() }),
  };

  return <div className={`app-shell has-console ${authenticated ? 'is-workspace' : 'is-landing'}`}>
    {ready && enabled && <Suspense fallback={null}>
      <Background assets={assets} preview={preview} paused={paused} openingScene={reviewAutoplay ? 'kungfu' : undefined} onState={setPlayback} />
    </Suspense>}
    <div className="site-header">
    <header className="app-content toolbar">
      <div id="account-controls" />
      <button type="button" className="header-language" title={language === 'en' ? 'Switch to Spanish' : 'Cambiar a inglés'} aria-label={language === 'en' ? 'Switch to Spanish' : 'Cambiar a inglés'} onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}>{language === 'en' ? 'EN' : 'ES'}</button>
      <details className="preferences" name="toolbar-menu" ref={preferencesMenu}>
        <summary aria-label={t('Ambiente, acerca de y ayuda')}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2v12M8 2v12M13 2v12M1 5h4M6 10h4M11 6h4" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg><span>{t('Ambiente')}</span></summary>
        <div className="preferences-panel">
          <h2>{t('Acerca de marKER')}</h2>
          <p className="setting-note">{t('Tu mesa privada para organizar productos, material y campañas, revisar contenido y preparar su entrega.')}</p>
          <h3>{t('Ambiente')}</h3>
          <EnvironmentSettings preferences={preferences} idPrefix="quick-environment" showCache={authenticated} />
          {authenticated && <Help topic="all" label={language === 'en' ? 'help section' : 'sección de ayuda'} />}
        </div>
      </details>
    </header>
    <main className="app-content identity" aria-label="marKER">
      {dark ? <svg className="brand" data-presentation="v2-dark" width="1942" height="809" viewBox="0 0 1942 809" role="img" aria-label="marKER — AI community manager">
        <defs>
          <filter id="marker-logo-v2-dark" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            {/* Pixel masks come only from the complete approved RGB source.
                Clear paper has B>=234; its alpha becomes zero. */}
            <feColorMatrix in="SourceGraphic" result="ink" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 -9.090909 0 8.272727" />
            <feColorMatrix in="SourceGraphic" result="orange" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  16 0 -16 0 -0.48" />
            <feComposite in="orange" in2="ink" operator="in" result="orangeInk" />
            <feComponentTransfer in="SourceGraphic" result="lightInk">
              <feFuncR type="linear" slope="-0.55" intercept="1" />
              <feFuncG type="linear" slope="-0.55" intercept="1" />
              <feFuncB type="linear" slope="-0.55" intercept="1" />
            </feComponentTransfer>
            <feComposite in="lightInk" in2="ink" operator="in" result="neutralInk" />
            <feComposite in="neutralInk" in2="orangeInk" operator="out" result="neutralOnly" />
            <feComposite in="SourceGraphic" in2="orangeInk" operator="in" result="originalOrange" />
            <feMerge><feMergeNode in="neutralOnly" /><feMergeNode in="originalOrange" /></feMerge>
          </filter>
        </defs>
        <image href="/brand/marker-logo-v1.png" width="1942" height="809" filter="url(#marker-logo-v2-dark)" />
      </svg> : <img className="brand" src="/brand/marker-logo-v1.png" width="1942" height="809" alt="marKER — AI community manager" fetchPriority="high" />}
    </main>
    </div>
    <Console onAccessChange={changeAccess} environment={<EnvironmentSettings preferences={preferences} idPrefix="settings-environment" showCache={authenticated} />} />
    {policy&&<Policies section={policy} onClose={closePolicy} onPreferences={()=>{if(preferencesMenu.current)preferencesMenu.current.open=true;}} />}
    <div className="brand-footer"><a className="aekr-signature" href="https://aekr.io" target="_blank" rel="noopener noreferrer" aria-label={t('Built with AEKR, abre en una pestaña nueva')}><img src="/brand/aekr-mark.svg" alt="" /><span>Built with <strong>AEKR</strong></span></a><PolicyLinks onOpen={openPolicy} variant="footer" /></div>
  </div>;
}
