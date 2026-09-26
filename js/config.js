// Site configuration: branding, contact and billing.
// Billing uses hosted payment pages (e.g. Stripe Payment Links), so no backend is needed.
// See docs/BILLING.md for setup. Leave a link empty and its button shows "Coming soon".

const CONFIG = {
  author: 'Alistair Nhiwatiwa',
  repoUrl: 'https://github.com/Onesayi/shift-one-helpdesk-simulator',
  contactEmail: '',            // e.g. 'you@example.com'; used for "Contact" buttons
  bookingUrl: '',              // optional Cal.com / Calendly page for scheduling sessions
  currency: '$',

  plans: [
    {
      id: 'free',
      name: 'Self-study',
      price: 0,
      per: 'forever',
      blurb: 'The full simulator in your browser.',
      features: ['All 11 tickets and every tool', 'Timed shift + practice mode', 'Shift report with feedback', 'Knowledge base of SOPs'],
      cta: 'Start playing',
      action: 'play',
    },
    {
      id: 'session',
      name: '1:1 Tutoring',
      price: 25,
      per: 'per 60-min session',
      blurb: 'Work a live shift while a tutor coaches you.',
      features: ['Live, screen-shared shift', 'Debrief of your shift report', 'Explain-your-fix practice', 'Personal study plan'],
      cta: 'Book a session',
      paymentLink: '',         // Stripe Payment Link URL
      highlight: true,
    },
    {
      id: 'pack',
      name: 'Interview Prep Pack',
      price: 80,
      per: '4 sessions',
      blurb: 'From zero to interview-ready for a Tier 1 role.',
      features: ['Everything in 1:1 Tutoring', 'Mock help desk interview', 'Scenarios matched to your target job', 'Feedback on the IT section of your CV'],
      cta: 'Buy the pack',
      paymentLink: '',
    },
    {
      id: 'class',
      name: 'Classroom & Bootcamp',
      price: null,
      per: 'custom quote',
      blurb: 'Group workshops for schools, bootcamps and teams.',
      features: ['Instructor-led workshops', 'Lesson plans + answer key', 'Custom scenario pack for your curriculum', 'Group leaderboard session'],
      cta: 'Contact for a quote',
      action: 'contact',
    },
  ],
};
