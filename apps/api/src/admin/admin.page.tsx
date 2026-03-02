import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ADMIN_STYLES, LOGIN_STYLES } from './ui/admin-styles';

type RenderOptions = {
  title: string;
  styles: string;
  scriptSrc: string;
  scriptType?: 'text/javascript' | 'module';
  bodyClassName?: string;
  children: React.ReactNode;
};

function renderDocument(options: RenderOptions): string {
  const html = renderToStaticMarkup(
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{options.title}</title>
        <style>{options.styles}</style>
      </head>
      <body className={options.bodyClassName}>
        {options.children}
        <script
          src={options.scriptSrc}
          type={options.scriptType ?? 'text/javascript'}
        ></script>
      </body>
    </html>,
  );

  return `<!doctype html>${html}`;
}

export function renderAdminLoginPage(): string {
  const cacheBust = Date.now().toString(36);
  return renderDocument({
    title: 'MSS+ Client Admin Login',
    styles: LOGIN_STYLES,
    scriptSrc: `/admin/login/app.js?v=${cacheBust}`,
    scriptType: 'module',
    children: (
      <div id="admin-login-root">
        <main className="login-shell">
          <h1>MSS+ Client Control Console</h1>
          <p>Loading login...</p>
          <div className="status">Ready.</div>
        </main>
      </div>
    ),
  });
}

export function renderAdminPage(): string {
  const cacheBust = Date.now().toString(36);
  return renderDocument({
    title: 'MSS+ Client Admin Console',
    styles: ADMIN_STYLES,
    scriptSrc: `/admin/app.js?v=${cacheBust}`,
    scriptType: 'module',
    children: (
      <div id="admin-root">
        <main className="main">
          <section className="panel">
            <h2>Loading admin console...</h2>
            <div className="status">Please wait.</div>
          </section>
        </main>
      </div>
    ),
  });
}
