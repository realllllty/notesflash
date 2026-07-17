import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { prepareRuntimeServiceWorker } from './lib/pwa';

async function bootstrap(): Promise<void> {
  const shouldMount = await prepareRuntimeServiceWorker();
  if (!shouldMount) return;

  mount(App, {
    target: document.getElementById('app')!
  });
}

void bootstrap();
