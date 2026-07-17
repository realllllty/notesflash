import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { registerPwaServiceWorker } from './lib/pwa';

registerPwaServiceWorker();

const app = mount(App, {
  target: document.getElementById('app')!
});

export default app;
