import { useEffect, useState } from 'react';
import { GameScene } from './components/GameScene';
import type { LangPack } from './game/types';
import { initEvents, emitSessionStart } from './game/events';
import { getProgress } from './game/storage';

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
    initEvents(userId, lang);
    const jsonPath = `./lang/${lang}/wordsmash.json`;
    loadJSON<LangPack>(jsonPath)
      .then((pack) => {
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
