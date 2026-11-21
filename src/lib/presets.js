/*
 * Dopablock – preset catalogue.
 *
 * Every site has "sections" (a feed, a tab, a sub-page …). A section matches
 * pages via `paths` and can additionally hide page elements via `hide`
 * (CSS selectors).
 *
 * Path pattern syntax (matched against location.pathname):
 *   /*            everything on the site
 *   /shorts/*     /shorts and everything below it
 *   /explore*     plain prefix
 *   /             exactly the root
 *   re:^/foo$     regular expression
 */
(function (root) {
  'use strict';

  // Optional locale prefix some sites use: /en, /de-DE …
  const L = '(?:/[a-z]{2}(?:-[A-Za-z]{2})?)?';

  const SITES = [
    {
      id: 'tiktok',
      name: 'TikTok',
      hosts: ['tiktok.com'],
      sections: [
        {
          id: 'fyp',
          name: 'For You (FYP)',
          desc: {
            en: 'The endless For You feed on the home page.',
            de: 'Der endlose „Für dich“-Feed auf der Startseite.',
          },
          paths: ['re:^' + L + '(?:/foryou)?/?$'],
        },
        {
          id: 'following',
          name: 'Following',
          desc: { en: 'Videos from accounts you follow.', de: 'Videos von Accounts, denen du folgst.' },
          paths: ['re:^' + L + '/following(?:/|$)'],
        },
        {
          id: 'explore',
          name: 'Explore',
          desc: { en: 'Trending and discover pages.', de: 'Trends und Entdecken-Seiten.' },
          paths: ['re:^' + L + '/explore(?:/|$)'],
        },
        {
          id: 'live',
          name: 'LIVE',
          desc: { en: 'Live streams.', de: 'Livestreams.' },
          paths: ['re:^' + L + '/live(?:/|$)', 're:^/@[^/]+/live(?:/|$)'],
        },
        {
          id: 'videos',
          name: 'Single videos',
          desc: { en: 'Opened video pages (…/@user/video/123).', de: 'Geöffnete Videoseiten (…/@user/video/123).' },
          paths: ['re:^/@[^/]+/video/'],
        },
        {
          id: 'all',
          name: 'Entire TikTok',
          desc: { en: 'The whole website.', de: 'Die gesamte Website.' },
          paths: ['/*'],
        },
      ],
    },
    {
      id: 'instagram',
      name: 'Instagram',
      hosts: ['instagram.com'],
      sections: [
        {
          id: 'reels',
          name: 'Reels',
          desc: { en: 'Reels tab, single reels and profile reels.', de: 'Reels-Tab, einzelne Reels und Profil-Reels.' },
          paths: ['re:^/(?:reels?(?:/|$)|[^/]+/reels?(?:/|$))'],
          hide: ['a[href="/reels/"]', 'a[href^="/reels"]'],
        },
        {
          id: 'feed',
          name: 'Home feed',
          desc: { en: 'The scrolling home feed.', de: 'Der scrollbare Startseiten-Feed.' },
          paths: ['/'],
        },
        {
          id: 'explore',
          name: 'Explore',
          desc: { en: 'Explore grid and search suggestions.', de: 'Entdecken-Raster und Suchvorschläge.' },
          paths: ['/explore/*'],
          hide: ['a[href="/explore/"]'],
        },
        {
          id: 'stories',
          name: 'Stories',
          desc: { en: 'Story viewer.', de: 'Story-Ansicht.' },
          paths: ['/stories/*'],
        },
        {
          id: 'all',
          name: 'Entire Instagram',
          desc: { en: 'The whole website.', de: 'Die gesamte Website.' },
          paths: ['/*'],
        },
      ],
    },
    {
      id: 'youtube',
      name: 'YouTube',
      hosts: ['youtube.com'],
      sections: [
        {
          id: 'shorts',
          name: 'Shorts',
          desc: {
            en: 'Shorts player plus Shorts shelves, tabs and results.',
            de: 'Shorts-Player sowie Shorts-Regale, -Tabs und -Ergebnisse.',
          },
          paths: ['/shorts/*'],
          hide: [
            'ytd-reel-shelf-renderer',
            'ytd-rich-shelf-renderer[is-shorts]',
            'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])',
            'ytd-guide-entry-renderer:has(a[title="Shorts"])',
            'ytd-mini-guide-entry-renderer[aria-label="Shorts"]',
            'ytd-video-renderer:has(a[href^="/shorts/"])',
            'ytd-grid-video-renderer:has(a[href^="/shorts/"])',
            'ytd-rich-item-renderer:has(a[href^="/shorts/"])',
            'ytm-reel-shelf-renderer',
            'ytm-shorts-lockup-view-model',
          ],
        },
        {
          id: 'home',
          name: 'Home feed',
          desc: { en: 'Recommended videos on the home page.', de: 'Empfohlene Videos auf der Startseite.' },
          paths: ['/'],
        },
        {
          id: 'recs',
          name: 'Suggested videos',
          desc: {
            en: 'Hides the sidebar and end-screen suggestions while watching.',
            de: 'Blendet Seitenleisten- und Endscreen-Vorschläge beim Schauen aus.',
          },
          paths: [],
          hide: ['#related', 'ytd-watch-next-secondary-results-renderer', '.ytp-endscreen-content', '.ytp-ce-element', '.ytp-suggestion-set'],
        },
        {
          id: 'comments',
          name: 'Comments',
          desc: { en: 'Hides the comment section.', de: 'Blendet die Kommentare aus.' },
          paths: [],
          hide: ['ytd-comments#comments', '#comments'],
        },
        {
          id: 'all',
          name: 'Entire YouTube',
          desc: { en: 'The whole website.', de: 'Die gesamte Website.' },
          paths: ['/*'],
        },
      ],
    },
    {
      id: 'snapchat',
      name: 'Snapchat',
      hosts: ['snapchat.com'],
      sections: [
        {
          id: 'spotlight',
          name: 'Spotlight',
          desc: { en: 'Spotlight videos.', de: 'Spotlight-Videos.' },
          paths: ['re:^(?:/[a-z]{2}-[A-Za-z]{2})?/(?:spotlight|web/spotlight)(?:/|$)'],
        },
        {
          id: 'discover',
          name: 'Discover & Stories',
          desc: { en: 'Discover and public stories.', de: 'Discover und öffentliche Stories.' },
          paths: ['re:^(?:/[a-z]{2}-[A-Za-z]{2})?/(?:discover|stories|story)(?:/|$)'],
        },
        {
          id: 'all',
          name: 'Entire Snapchat',
          desc: { en: 'The whole website.', de: 'Die gesamte Website.' },
          paths: ['/*'],
        },
      ],
    },
    {
      id: 'facebook',
      name: 'Facebook',
      hosts: ['facebook.com'],
      sections: [
        {
          id: 'feed',
          name: 'Home feed',
          desc: { en: 'The news feed.', de: 'Der Newsfeed.' },
          paths: ['/'],
        },
        {
          id: 'reels',
          name: 'Reels',
          desc: { en: 'Reels and short videos.', de: 'Reels und Kurzvideos.' },
          paths: ['/reel/*', '/reels/*'],
        },
        {
          id: 'watch',
          name: 'Watch',
          desc: { en: 'Facebook Watch videos.', de: 'Facebook-Watch-Videos.' },
          paths: ['/watch/*'],
        },
        {
          id: 'marketplace',
          name: 'Marketplace',
          desc: { en: 'Marketplace listings.', de: 'Marketplace-Angebote.' },
          paths: ['/marketplace/*'],
        },
        {
          id: 'stories',
          name: 'Stories',
          desc: { en: 'Story viewer.', de: 'Story-Ansicht.' },
          paths: ['/stories/*'],
        },
        {
          id: 'all',
          name: 'Entire Facebook',
          desc: { en: 'The whole website.', de: 'Die gesamte Website.' },
          paths: ['/*'],
        },
      ],
    },
    {
      id: 'x',
      name: 'X / Twitter',
      hosts: ['x.com', 'twitter.com'],
      sections: [
        {
          id: 'home',
          name: 'Home timeline',
          desc: { en: 'For You and Following timelines.', de: 'Für-dich- und Folge-ich-Timeline.' },
          paths: ['/home/*'],
        },
        {
          id: 'explore',
          name: 'Explore & Trends',
          desc: { en: 'Explore, trending and search suggestions.', de: 'Entdecken, Trends und Suchvorschläge.' },
          paths: ['/explore/*', '/i/trends/*'],
        },
        {
          id: 'sidebar',
          name: 'Sidebar',
          desc: { en: 'Hides "What’s happening" and "Who to follow".', de: 'Blendet „Das passiert gerade“ und „Wem folgen“ aus.' },
          paths: [],
          hide: ['[data-testid="sidebarColumn"]'],
        },
        {
          id: 'all',
          name: 'Entire X',
          desc: { en: 'The whole website.', de: 'Die gesamte Website.' },
          paths: ['/*'],
        },
      ],
    },
    {
      id: 'reddit',
      name: 'Reddit',
      hosts: ['reddit.com'],
      sections: [
        {
          id: 'home',
          name: 'Home feed',
          desc: { en: 'Your personalised front page.', de: 'Deine personalisierte Startseite.' },
          paths: ['/'],
        },
        {
          id: 'popular',
          name: 'Popular & All',
          desc: { en: 'r/popular and r/all.', de: 'r/popular und r/all.' },
          paths: ['/r/popular/*', '/r/all/*', '/popular/*', '/all/*'],
        },
        {
          id: 'all',
          name: 'Entire Reddit',
          desc: { en: 'The whole website.', de: 'Die gesamte Website.' },
          paths: ['/*'],
        },
      ],
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      hosts: ['linkedin.com'],
      sections: [
        {
          id: 'feed',
          name: 'Feed',
          desc: { en: 'The LinkedIn feed.', de: 'Der LinkedIn-Feed.' },
          paths: ['/feed/*'],
        },
        {
          id: 'all',
          name: 'Entire LinkedIn',
          desc: { en: 'The whole website.', de: 'Die gesamte Website.' },
          paths: ['/*'],
        },
      ],
    },
    {
      id: 'threads',
      name: 'Threads',
      hosts: ['threads.net', 'threads.com'],
      sections: [
        { id: 'feed', name: 'Home feed', desc: { en: 'The scrolling feed.', de: 'Der scrollbare Feed.' }, paths: ['/'] },
        { id: 'search', name: 'Search & discover', desc: { en: 'Search and suggested posts.', de: 'Suche und vorgeschlagene Beiträge.' }, paths: ['/search/*'] },
        { id: 'all', name: 'Entire Threads', desc: { en: 'The whole website.', de: 'Die gesamte Website.' }, paths: ['/*'] },
      ],
    },
    {
      id: 'bluesky',
      name: 'Bluesky',
      hosts: ['bsky.app'],
      sections: [
        { id: 'feed', name: 'Home feed', desc: { en: 'Your timeline and feeds.', de: 'Deine Timeline und Feeds.' }, paths: ['/'] },
        { id: 'explore', name: 'Explore', desc: { en: 'Trending topics and discovery.', de: 'Trends und Entdecken.' }, paths: ['/search/*', '/feeds/*'] },
        { id: 'all', name: 'Entire Bluesky', desc: { en: 'The whole website.', de: 'Die gesamte Website.' }, paths: ['/*'] },
      ],
    },
    {
      id: 'pinterest',
      name: 'Pinterest',
      hosts: ['pinterest.com'],
      sections: [
        { id: 'home', name: 'Home feed', desc: { en: 'The endless pin feed.', de: 'Der endlose Pin-Feed.' }, paths: ['re:^(?:/[a-z]{2})?/?$'] },
        { id: 'today', name: 'Today & ideas', desc: { en: 'Today, ideas and explore pages.', de: 'Heute-, Ideen- und Entdecken-Seiten.' }, paths: ['/today/*', '/ideas/*', '/explore/*'] },
        { id: 'all', name: 'Entire Pinterest', desc: { en: 'The whole website.', de: 'Die gesamte Website.' }, paths: ['/*'] },
      ],
    },
    {
      id: 'discord',
      name: 'Discord',
      hosts: ['discord.com'],
      sections: [
        { id: 'all', name: 'Entire Discord', desc: { en: 'The whole website.', de: 'Die gesamte Website.' }, paths: ['/*'] },
      ],
    },
    {
      id: 'twitch',
      name: 'Twitch',
      hosts: ['twitch.tv'],
      sections: [
        { id: 'all', name: 'Entire Twitch', desc: { en: 'The whole website.', de: 'Die gesamte Website.' }, paths: ['/*'] },
      ],
    },
    {
      id: 'netflix',
      name: 'Netflix',
      hosts: ['netflix.com'],
      sections: [
        { id: 'all', name: 'Entire Netflix', desc: { en: 'The whole website.', de: 'Die gesamte Website.' }, paths: ['/*'] },
      ],
    },
  ];

  const api = { SITES };
  root.DopaBlock = Object.assign(root.DopaBlock || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
