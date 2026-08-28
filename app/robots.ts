import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = 'https://www.sohocambados.es';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/checkout/', '/api/']
      }
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base
  };
}