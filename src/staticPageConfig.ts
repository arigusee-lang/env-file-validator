export type StaticPageConfig = {
  id: 'privacy' | 'contact';
  routePath: '/privacy-policy' | '/contact';
  title: string;
  description: string;
  canonicalUrl: string;
  ogImageUrl: string;
  eyebrow: string;
  heading: string;
  lede: string;
  sections: Array<{
    title: string;
    body: string[];
  }>;
};

const SITE_URL = 'https://envvalidator.com';
const SHARED_OG_IMAGE = `${SITE_URL}/og-image.svg`;
const CONTACT_EMAIL = 'arigusee@gmail.com';

export const privacyPageConfig: StaticPageConfig = {
  id: 'privacy',
  routePath: '/privacy-policy',
  title: 'Privacy Policy - Env File Validator',
  description:
    'Privacy policy for Env File Validator, including local processing, advertising, consent, and contact details.',
  canonicalUrl: `${SITE_URL}/privacy-policy`,
  ogImageUrl: SHARED_OG_IMAGE,
  eyebrow: 'Privacy',
  heading: 'Privacy Policy',
  lede:
    'Env File Validator is designed to keep validation work in the browser while still explaining clearly how advertising, privacy choices, and contact requests are handled.',
  sections: [
    {
      title: 'Local processing',
      body: [
        'Environment and properties file text pasted into the validator is parsed and compared locally in your browser.',
        'The core validation flow does not require an account and does not require server-side upload of file contents.',
      ],
    },
    {
      title: 'Data retention',
      body: [
        'This site does not intentionally store the contents you paste into the validator as part of the core comparison flow.',
        'Browser-provided local settings such as theme preference may be stored on your device so the interface can remember your last selection.',
      ],
    },
    {
      title: 'Advertising',
      body: [
        'This site may use Google AdSense to display advertising.',
        'Google and its partners may use cookies or similar technologies to measure advertising, prevent fraud, and serve ads depending on region-specific requirements and the choices a visitor makes.',
      ],
    },
    {
      title: 'Consent and privacy choices',
      body: [
        'Where required, consent and privacy choices are handled through Google Funding Choices or other Google-provided privacy messaging flows.',
        'If a privacy settings link is shown on this site, you can use it to review or update your advertising choices.',
      ],
    },
    {
      title: 'Third-party services',
      body: [
        'Google may act as a third-party advertising and privacy messaging provider on this site.',
        'Please review Google policies and product documentation for more information about how Google processes advertising-related data.',
      ],
    },
    {
      title: 'Contact',
      body: [
        `For privacy questions, advertising questions, or site feedback, contact ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};

export const contactPageConfig: StaticPageConfig = {
  id: 'contact',
  routePath: '/contact',
  title: 'Contact - Env File Validator',
  description:
    'Contact information for Env File Validator, including the publisher email for site feedback, privacy, and advertising questions.',
  canonicalUrl: `${SITE_URL}/contact`,
  ogImageUrl: SHARED_OG_IMAGE,
  eyebrow: 'Contact',
  heading: 'Contact',
  lede:
    'Use the address below for privacy questions, advertising questions, site feedback, or general communication about Env File Validator.',
  sections: [
    {
      title: 'Email',
      body: [
        CONTACT_EMAIL,
      ],
    },
    {
      title: 'What to include',
      body: [
        'If you are reporting a site issue, include the page URL, the browser or device involved, and a short description of what happened.',
        'If your question is about privacy or advertising, include enough context so the request can be understood without sending any sensitive file contents.',
      ],
    },
  ],
};

const staticPages = [privacyPageConfig, contactPageConfig] as const;

export function getStaticPage(pathname: string) {
  return staticPages.find((page) => pathname === page.routePath) ?? null;
}

