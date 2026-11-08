import '../ui/app.css';
import './editor.css';
import { showLogin } from './login';

/** Start de puzzelbouwer (?bouwer): eerst inloggen, dan het bouwscherm. */
export async function mount(root: HTMLElement): Promise<void> {
  document.title = 'Lichtbreker – Bouwer';
  const session = await showLogin(root);
  const { startEditor } = await import('./screen');
  await startEditor(root, session);
}
