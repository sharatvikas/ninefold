import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import '@fontsource-variable/figtree';
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import { setupFromBrowser } from './analytics/setup';
import { App } from './ui/app';

setupFromBrowser();
new App(document.getElementById('app')!);
