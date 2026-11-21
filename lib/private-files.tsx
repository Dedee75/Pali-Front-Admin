"use client";

import { useEffect, useRef, useState, type AnchorHTMLAttributes, type ImgHTMLAttributes } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim() || API_URL;
const EMPTY_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

// Only our configured backend may receive the account's Bearer token.
export function privateFileUrl(source: string): string | null {
  try {
    const api = new URL(API_URL);
    const target = new URL(source, api.origin);
    if (target.username || target.password || target.hash) return null;
    for (const endpoint of [API_URL, BACKEND_URL]) {
      const backend = new URL(endpoint);
      const base = backend.pathname.replace(/\/+$/, '');
      if (target.origin === backend.origin &&
          (target.pathname.startsWith(`${base}/uploads/`) ||
           target.pathname.startsWith(`${base}/student-images/`))) return target.href;
    }
  } catch { /* Local previews and non-HTTP sources use their original URL. */ }
  return null;
}

export function privateFileToken(): string | null {
  try { return sessionStorage.getItem('accessToken')?.trim() || null; }
  catch { return null; }
}

export async function fetchPrivateFile(source: string, token: string, signal?: AbortSignal): Promise<Blob> {
  const url = privateFileUrl(source);
  if (!url) throw new Error('Invalid private file URL');
  if (!token) throw new Error('ပြန်လည် Login ဝင်ပေးပါ။');
  const timeout = AbortSignal.timeout(30000);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store', credentials: 'omit', redirect: 'error',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error(response.status === 401
    ? 'Login သက်တမ်းကုန်နေပါသည်။ ပြန်လည် Login ဝင်ပေးပါ။'
    : 'ဖိုင်ကို ကြည့်ရှုခွင့်မရှိပါ သို့မဟုတ် ဖိုင်မရှိတော့ပါ။');
  return response.blob();
}

export function PrivateImage({ src, loading, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const image = useRef<HTMLImageElement>(null);
  const source = typeof src === 'string' ? src : '';
  const privateUrl = privateFileUrl(source);
  const token = privateUrl ? privateFileToken() : null;
  const [loaded, setLoaded] = useState<{ source: string; token: string | null; url: string } | null>(null);
  useEffect(() => {
    if (!privateUrl) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    let started = false;
    const load = () => {
      if (started) return;
      started = true;
      void fetchPrivateFile(privateUrl, token ?? '', controller.signal).then(blob => {
        if (controller.signal.aborted || privateFileToken() !== token) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ source, token, url: objectUrl });
      }).catch(() => {
        if (!controller.signal.aborted) setLoaded({ source, token, url: 'data:,' });
      });
    };
    let observer: IntersectionObserver | undefined;
    if (loading !== 'eager' && image.current && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) { observer?.disconnect(); load(); }
      }, { rootMargin: '300px' });
      observer.observe(image.current);
    } else load();
    return () => { controller.abort(); observer?.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [privateUrl, source, token, loading]);
  const displayed = privateUrl
    ? (loaded?.source === source && loaded.token === token ? loaded.url : EMPTY_IMAGE)
    : src;
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} ref={image} src={displayed} srcSet={privateUrl ? undefined : props.srcSet} loading={loading} alt={props.alt ?? ''} />;
}

export function PrivateFileLink({ href, children, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const urls = useRef(new Set<string>());
  const pending = useRef(new Set<AbortController>());
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const activeUrls = urls.current;
    const requests = pending.current;
    return () => { mounted.current = false; for (const controller of requests) controller.abort(); requests.clear(); for (const url of activeUrls) URL.revokeObjectURL(url); activeUrls.clear(); };
  }, []);
  return <>
    <a {...props} href={href} aria-busy={busy || undefined} onClick={event => {
      onClick?.(event);
      if (event.defaultPrevented || !href || !privateFileUrl(href)) return;
      event.preventDefault();
      if (busy) return;
      const token = privateFileToken();
      if (!token) { setError('ပြန်လည် Login ဝင်ပေးပါ။'); return; }
      const tab = props.download ? null : window.open('about:blank', '_blank');
      if (!props.download && !tab) { setError('ဖိုင်ဖွင့်ရန် browser popup ခွင့်ပြုပေးပါ။'); return; }
      if (tab) tab.opener = null;
      setBusy(true); setError('');
      const controller = new AbortController();
      pending.current.add(controller);
      void fetchPrivateFile(href, token, controller.signal).then(blob => {
        if (!mounted.current || privateFileToken() !== token) { tab?.close(); return; }
        const url = URL.createObjectURL(blob);
        urls.current.add(url);
        if (tab) tab.location.replace(url);
        else {
          const link = document.createElement('a');
          link.href = url;
          link.download = typeof props.download === 'string' ? props.download : 'download';
          link.click();
        }
      }).catch(reason => {
        tab?.close();
        if (mounted.current) setError(reason instanceof Error ? reason.message : 'ဖိုင်ဖွင့်မရပါ။');
      }).finally(() => { pending.current.delete(controller); if (mounted.current) setBusy(false); });
    }}>{children}</a>
    {error && <span role='alert'>{error}</span>}
  </>;
}
