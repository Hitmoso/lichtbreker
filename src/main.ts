import './ui/theme.css';
import { startApp } from './ui/app';

void startApp(document.getElementById('app')!).then((ctx) => {
  if (import.meta.env.DEV) Object.assign(window, { __lb: ctx });
});
