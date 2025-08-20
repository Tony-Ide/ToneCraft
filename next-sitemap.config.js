/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://tonecraft.org',
  generateRobotsTxt: true,
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
  },
  changefreq: 'weekly',
  priority: 0.7,
}
