import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://www.krishnafluteacademy.com';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/temp-debug/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
