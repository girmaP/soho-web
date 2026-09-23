'use client';

import { useEffect } from 'react';

export function SiteMotion() {
  useEffect(() => {
    const root = document.documentElement;
    const progress = document.createElement('div');
    progress.className = 'soho-scroll-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progress);

    const revealTargets = Array.from(
      document.querySelectorAll<HTMLElement>(
        'main section, main article, main form, main [data-motion-card], footer > div > div > div'
      )
    );

    revealTargets.forEach((element, index) => {
      element.classList.add('soho-reveal');
      element.style.setProperty('--soho-reveal-delay', `${Math.min(index % 6, 5) * 55}ms`);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).classList.add('soho-reveal-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -5% 0px' }
    );

    revealTargets.forEach((element) => observer.observe(element));

    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      root.style.setProperty('--soho-scroll', String(Math.min(1, window.scrollY / max)));
    };

    const onPointerMove = (event: PointerEvent) => {
      root.style.setProperty('--soho-pointer-x', `${event.clientX}px`);
      root.style.setProperty('--soho-pointer-y', `${event.clientY}px`);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
      progress.remove();
    };
  }, []);

  return null;
}
