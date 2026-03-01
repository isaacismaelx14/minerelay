import { createRoot } from 'react-dom/client';
import { AdminProvider } from './admin-context';
import { AdminApp } from './admin-components';

function mount(): void {
  const rootElement = document.getElementById('admin-root');
  if (!rootElement) {
    throw new Error('Missing admin root element');
  }

  createRoot(rootElement).render(
    <AdminProvider>
      <AdminApp />
    </AdminProvider>,
  );
}

mount();
