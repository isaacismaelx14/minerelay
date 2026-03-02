import { createRoot } from 'react-dom/client';
import { AdminProvider } from './admin-context';
import { AdminApp } from './admin-components';

declare global {
  interface Window {
    __mvlAdminMounted?: boolean;
  }
}

function mount(): void {
  if (window.__mvlAdminMounted) {
    return;
  }
  const rootElement = document.getElementById('admin-root');
  if (!rootElement) {
    throw new Error('Missing admin root element');
  }

  window.__mvlAdminMounted = true;
  createRoot(rootElement).render(
    <AdminProvider>
      <AdminApp />
    </AdminProvider>,
  );
}

mount();
