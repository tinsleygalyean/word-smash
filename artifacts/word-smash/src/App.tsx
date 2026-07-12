import { useEffect, useState } from 'react';
import { GameScene } from './components/GameScene';
import type { LangPack } from './game/types';
import { initEvents, emitSessionStart } from './game/events';
import { getProgress, resetProgress } from './game/storage';

function loadJSON<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'text';
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 0) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch (e) { reject(e); }
      } else {
        reject(new Error(`loadJSON ${url} → ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error(`loadJSON XHR error: ${url}`));
    xhr.send();
  });
}

// Audio paths in the language pack are stored relative to the pack's own
// directory (e.g. "audios/cat_natural.mp3"). Resolve them against the pack
// location (`./lang/{lang}/`) so the loadBinary XHR finds them in dev (base
// path) and in the offline standalone bundle (base "./") alike.
function resolveAudioPaths(pack: LangPack, lang: string): LangPack {
  const prefix = `./lang/${lang}/`;
  const abs = (p: string) => (/^([a-z]+:)?\/\//i.test(p) || p.startsWith(prefix) ? p : prefix + p);
  return {
    ...pack,
    levels: pack.levels.map((lvl) => ({
      ...lvl,
      words: lvl.words.map((w) => ({
        ...w,
        audio: {
          slow: abs(w.audio.slow),
          natural: abs(w.audio.natural),
          units: w.audio.units.map(abs),
        },
      })),
    })),
  };
}

function getLaunchParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    lang: params.get('cr_lang') || 'english',
    userId: params.get('cr_user_id') || '',
  };
}

export default function App() {
  const [langPack, setLangPack] = useState<LangPack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { lang, userId } = getLaunchParams();

  useEffect(() => {
    // ?reset=1 (or ?cr_reset) wipes saved progress → start at level 1, then
    // strips the flag so a normal refresh doesn't reset again.
    const params = new URLSearchParams(window.location.search);
    if (params.has('reset') || params.has('cr_reset')) {
      resetProgress(lang);
      params.delete('reset');
      params.delete('cr_reset');
      const clean = window.location.pathname + (params.toString() ? `?${params}` : '');
      window.history.replaceState(null, '', clean);
    }
    initEvents(userId, lang);
    const jsonPath = `./lang/${lang}/wordsmash.json`;
    loadJSON<LangPack>(jsonPath)
      .then((rawPack) => {
        const pack = resolveAudioPaths(rawPack, lang);
        setLangPack(pack);
        const { currentLevel } = getProgress(lang);
        emitSessionStart(currentLevel);
      })
      .catch((e) => {
        console.error('Failed to load language pack:', e);
        setError('Failed to load game data.');
      });
  }, [lang, userId]);

  if (error) {
    return (
      <div className="ws-loading">
        <div className="ws-loading-text" style={{ color: '#ff6b6b' }}>⚠ {error}</div>
      </div>
    );
  }

  if (!langPack) {
    return (
      <div className="ws-loading">
        <div className="ws-loading-text">Loading Word Smash…</div>
        <div className="ws-loading-dots">
          <span /><span /><span />
        </div>
      </div>
    );
  }

  return <GameScene langPack={langPack} lang={lang} />;
}
