import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.sohocambados.es';
  const lastModified = new Date('2026-08-28');

  const pages = [
    { path: '', priority: 1, changeFrequency: 'weekly' as const },
    { path: '/menu', priority: 0.9, changeFrequency: 'daily' as const },
    {
      path: '/sobre-nosotros',
      priority: 0.7,
      changeFrequency: 'monthly' as const
    },
    {
      path: '/preguntas-frecuentes',
      priority: 0.6,
      changeFrequency: 'monthly' as const
    },
    {
      path: '/condiciones',
      priority: 0.4,
      changeFrequency: 'yearly' as const
    },
    {
      path: '/privacidad',
      priority: 0.3,
      changeFrequency: 'yearly' as const
    },
    {
      path: '/legal',
      priority: 0.3,
      changeFrequency: 'yearly' as const
    },
    {
      path: '/cookies',
      priority: 0.3,
      changeFrequency: 'yearly' as const
    }
  ];

  return pages.map((page) => ({
    url: `${base}${page.path}`,
    lastModified,
    changeFrequency: page.changeFrequency,
    priority: page.priority
  }));
}
