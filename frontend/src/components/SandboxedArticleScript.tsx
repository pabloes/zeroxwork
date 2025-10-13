import React, { useEffect, useMemo, useRef } from 'react';

type SandboxedArticleScriptProps = {
  code: string;
  initialHtml?: string;     // Optional pre-rendered Markdown HTML injected before running the script
  initialMarkdown?: string; // Optional Markdown that will be converted to HTML before running the script
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  autoRun?: boolean;
  timeoutMs?: number;       // soft timeout for script execution
  runInline?: boolean;      // if true, execute in-page (not sandboxed). If false, use iframe sandbox.
};

/**
 * Runs article scripts either:
 * - Inline (not sandboxed): injects helpers on window and imports a blob module with transformed code.
 * - Or inside a sandboxed iframe (legacy mode).
 * It exposes window.getArticleElement() and window.content helpers for scripts to manipulate the rendered Markdown.
 * Bare-specifier imports are rewritten to jsdelivr CDN; full URLs work as-is.
 */
const SandboxedArticleScript: React.FC<SandboxedArticleScriptProps> = ({
  code,
  initialHtml,
  initialMarkdown,
  height = 400,
  className,
  style,
  autoRun = true,
  timeoutMs = 2000,
  runInline = false,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Shared transformer used by both modes
  const transformUserCode = (src: string) => {
    const resolveSpecifier = (spec: string) => {
      if (/^https?:\/\//.test(spec)) return spec;
      if (spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/')) return spec;
      return 'https://cdn.jsdelivr.net/npm/' + spec;
    };
    // import 'pkg';
    src = src.replace(/^\s*import\s*(['"])([^'"]+)\1\s*;?\s*$/gm, (_m, _q, spec) => {
      const url = resolveSpecifier(spec);
      return `await import('${url}');`;
    });
    // import name from 'pkg';
    src = src.replace(/^\s*import\s+([\w$]+)\s+from\s+(['"])([^'"]+)\2\s*;?\s*$/gm, (_m, name, _q, spec) => {
      const url = resolveSpecifier(spec);
      return `const { default: ${name} } = await import('${url}');`;
    });
    // import * as ns from 'pkg';
    src = src.replace(/^\s*import\s+\*\s+as\s+([\w$]+)\s+from\s+(['"])([^'"]+)\2\s*;?\s*$/gm, (_m, ns, _q, spec) => {
      const url = resolveSpecifier(spec);
      return `const ${ns} = await import('${url}');`;
    });
    // import { a, b as c } from 'pkg';
    src = src.replace(/^\s*import\s+\{([^}]+)\}\s+from\s+(['"])([^'"]+)\2\s*;?\s*$/gm, (_m, names, _q, spec) => {
      const url = resolveSpecifier(spec);
      const cleaned = String(names).trim();
      return `const {${cleaned}} = await import('${url}');`;
    });
    // dynamic import('pkg')
    src = src.replace(/import\s*\(\s*(['"])([^'"]+)\1\s*\)/g, (_m, _q, spec) => {
      const url = resolveSpecifier(spec);
      return `import('${url}')`;
    });
    return src;
  };

  // Inline, non-sandbox execution path
  useEffect(() => {
    if (!runInline || !autoRun) return;
    const root = rootRef.current;
    if (!root) return;

    // Render initial content
    const setInitial = async () => {
      if (typeof initialHtml === 'string' && initialHtml) {
        root.innerHTML = initialHtml;
      } else if (typeof initialMarkdown === 'string' && initialMarkdown) {
        try {
          const markedMod = await import('https://cdn.jsdelivr.net/npm/marked@12.0.2/lib/marked.esm.js');
          const html = markedMod.marked.parse(initialMarkdown);
          root.innerHTML = html;
        } catch {
          root.textContent = initialMarkdown;
        }
      }
    };

    // Expose helpers on window
    const w = window as any;
    const prevGetArticleElement = w.getArticleElement;
    const prevContent = w.content;
    w.getArticleElement = function getArticleElement() {
      return root;
    };
    w.content = {
      set(html: any) {
        root.innerHTML = (typeof html === 'string' ? html : String(html));
      },
      append(html: any) {
        const tmp = document.createElement('div');
        tmp.innerHTML = (typeof html === 'string' ? html : String(html));
        while (tmp.firstChild) root.appendChild(tmp.firstChild);
      },
    };

    let blobUrl: string | null = null;
    let timeoutHandle: any = null;

    (async () => {
      await setInitial();
      const transformed = transformUserCode(code);
      const blob = new Blob([transformed], { type: 'text/javascript' });
      blobUrl = URL.createObjectURL(blob);

      let timedOut = false;
      if (timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          // soft timeout, script may still finish later
          // eslint-disable-next-line no-console
          console.warn(`[Article Script] Execution soft-timeout reached (${timeoutMs}ms)`);
        }, timeoutMs);
      }

      try {
        if (!timedOut) {
          await import(/* @vite-ignore */ blobUrl);
        }
      } catch (err: any) {
        const pre = document.createElement('pre');
        pre.style.color = 'crimson';
        pre.textContent = 'Script error: ' + (err && err.message ? err.message : String(err));
        root.appendChild(pre);
        // eslint-disable-next-line no-console
        console.error('[Article Script] Error:', err);
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (blobUrl) URL.revokeObjectURL(blobUrl);
      }
    })();

    // Cleanup
    return () => {
      (window as any).getArticleElement = prevGetArticleElement;
      (window as any).content = prevContent;
    };
  }, [runInline, autoRun, code, initialHtml, initialMarkdown, timeoutMs]);

  // Iframe sandboxed mode (legacy)
  const srcDoc = useMemo(() => {
    if (runInline) return '';
    const codeJson = JSON.stringify(code);
    const initialHtmlJson = JSON.stringify((typeof initialHtml === 'string' ? initialHtml : ''));
    const initialMarkdownJson = JSON.stringify((typeof initialMarkdown === 'string' ? initialMarkdown : ''));

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; padding: 0; }
    #article-root { padding: 8px; box-sizing: border-box; }
    pre { white-space: pre-wrap; }
  </style>
</head>
<body>
  <div id="article-root"></div>

  <script type="module">
    const root = document.getElementById('article-root');
    const INITIAL_HTML = ${initialHtmlJson};
    const INITIAL_MARKDOWN = ${initialMarkdownJson};
    if (INITIAL_HTML) {
      root.innerHTML = INITIAL_HTML;
    } else if (INITIAL_MARKDOWN) {
      try {
        const markedMod = await import('https://cdn.jsdelivr.net/npm/marked@12.0.2/lib/marked.esm.js');
        const html = markedMod.marked.parse(INITIAL_MARKDOWN);
        root.innerHTML = html;
      } catch {
        root.textContent = INITIAL_MARKDOWN;
      }
    }
    window.getArticleElement = function getArticleElement() { return root; };
    window.content = {
      set(html) { root.innerHTML = (typeof html === 'string' ? html : String(html)); },
      append(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = (typeof html === 'string' ? html : String(html));
        while (tmp.firstChild) root.appendChild(tmp.firstChild);
      }
    };
    function resolveSpecifier(spec) {
      if (/^https?:\\/\\//.test(spec)) return spec;
      if (spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/')) return spec;
      return 'https://cdn.jsdelivr.net/npm/' + spec;
    }
    function transformUserCode(src) {
      src = src.replace(/^\\s*import\\s*(['"])([^'"]+)\\1\\s*;?\\s*$/gm, (_m, _q, spec) => \`await import('\${resolveSpecifier(spec)}');\`);
      src = src.replace(/^\\s*import\\s+([\\w$]+)\\s+from\\s+(['"])([^'"]+)\\2\\s*;?\\s*$/gm, (_m, name, _q, spec) => \`const { default: \${name} } = await import('\${resolveSpecifier(spec)}');\`);
      src = src.replace(/^\\s*import\\s+\\*\\s+as\\s+([\\w$]+)\\s+from\\s+(['"])([^'"]+)\\2\\s*;?\\s*$/gm, (_m, ns, _q, spec) => \`const \${ns} = await import('\${resolveSpecifier(spec)}');\`);
      src = src.replace(/^\\s*import\\s+\\{([^}]+)\\}\\s+from\\s+(['"])([^'"]+)\\2\\s*;?\\s*$/gm, (_m, names, _q, spec) => \`const {\${String(names).trim()}} = await import('\${resolveSpecifier(spec)}');\`);
      src = src.replace(/import\\s*\\(\\s*(['"])([^'"]+)\\1\\s*\\)/g, (_m, _q, spec) => \`import('\${resolveSpecifier(spec)}')\`);
      return src;
    }
    const USER_CODE = ${codeJson};
    const TRANSFORMED = transformUserCode(USER_CODE);
    const blob = new Blob([TRANSFORMED], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    let timedOut = false;
    const timeoutHandle = ${String(timeoutMs)} > 0 ? setTimeout(() => { timedOut = true; console.warn('[Article Script] Execution soft-timeout reached (${String(timeoutMs)}ms)'); }, ${String(timeoutMs)}) : null;
    try {
      if (!timedOut) { await import(url); }
    } catch (err) {
      const pre = document.createElement('pre');
      pre.style.color = 'crimson';
      pre.textContent = 'Script error: ' + (err && err.message ? err.message : String(err));
      root.appendChild(pre);
      console.error('[Article Script] Error:', err);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>
    `.trim();
    return html;
  }, [runInline, code, timeoutMs, initialHtml, initialMarkdown]);

  const resolvedHeight = typeof height === 'number' ? `${height}px` : height;

  useEffect(() => {
    if (!autoRun || runInline) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    // srcDoc executes automatically when set
  }, [srcDoc, autoRun, runInline]);

  if (runInline) {
    return (
      <div
        ref={rootRef}
        className={className}
        style={{ width: '100%', minHeight: resolvedHeight, ...style }}
        aria-label="Article Script Inline Container"
      />
    );
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      className={className}
      style={{ border: '1px solid #e0e0e0', width: '100%', height: resolvedHeight, ...style }}
      aria-label="Article Script Sandbox"
    />
  );
};

export default SandboxedArticleScript;
