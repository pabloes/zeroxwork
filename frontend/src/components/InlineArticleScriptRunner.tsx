import { useEffect } from 'react';

type InlineArticleScriptRunnerProps = {
  code: string;
  targetSelector?: string; // CSS selector for the article container (default: #article-content)
  timeoutMs?: number;      // soft timeout before warning
};

/**
 * Executes the given script inline (not sandboxed) to complement the rendered Markdown.
 * - Exposes window.getArticleElement(): HTMLElement pointing to the Markdown container.
 * - Exposes window.content.set/append helpers.
 * - Supports static and dynamic imports; bare specifiers are rewritten to jsdelivr CDN.
 * - Cleans up global helpers on unmount.
 * Returns null (renders nothing).
 */
const InlineArticleScriptRunner: React.FC<InlineArticleScriptRunnerProps> = ({
  code,
  targetSelector = '#article-content',
  timeoutMs = 2000,
}) => {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(targetSelector);
    if (!root) {
      // eslint-disable-next-line no-console
      console.warn(`[Article Script] Target element not found for selector: ${targetSelector}`);
      return;
    }

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

    // Transform imports to CDN URLs so "import x from 'pkg'" works in the browser without bundling
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

    let blobUrl: string | null = null;
    let timeoutHandle: any = null;

    (async () => {
      const transformed = transformUserCode(code);
      const blob = new Blob([transformed], { type: 'text/javascript' });
      blobUrl = URL.createObjectURL(blob);

      let timedOut = false;
      if (timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
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

    // Cleanup on unmount
    return () => {
      (window as any).getArticleElement = prevGetArticleElement;
      (window as any).content = prevContent;
    };
  }, [code, targetSelector, timeoutMs]);

  return null;
};

export default InlineArticleScriptRunner;
