import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { loadFonts } from './game/fonts';

void loadFonts();

createRoot(document.getElementById('root')!).render(<App />);
