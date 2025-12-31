# Tropicana Worldwide Corp. Website

A modern, premium hotel and resort website built with Next.js 16, featuring elegant dark-themed UI, smooth animations, and integrated email functionality.

![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black)
![React](https://img.shields.io/badge/React-19-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)

## ✨ Features

- **Modern UI/UX** – Dark theme with serif typography, gold accents, and glassmorphism effects
- **Responsive Design** – Fully optimized for desktop, tablet, and mobile
- **Smooth Animations** – Page transitions and micro-interactions using Framer Motion
- **Contact Form** – Email integration via Resend with auto-reply functionality
- **Bot Protection** – Cloudflare Turnstile invisible CAPTCHA
- **Room Booking Flow** – Property browsing, room selection, and booking confirmation with PDF receipt generation
- **Dynamic Content** – Properties, rooms, dining menus, and events from mock data

## 📁 Project Structure

```
app/
├── page.tsx              # Homepage with hero carousel
├── about/                # About us page
├── properties/           # Property listing & detail pages
│   └── [slug]/rooms/     # Room details with booking
├── book/                 # Booking flow
│   └── confirmation/     # Booking confirmation + PDF receipt
├── contact/              # Contact form with email integration
├── dining/               # Restaurant & menu showcase
├── events/               # Events & conference spaces
├── careers/              # Job opportunities
├── privacy/              # Privacy policy
├── terms/                # Terms of service
└── api/
    └── contact/          # Email API route (Resend + Zod validation)

components/
├── layout/               # Navbar, Footer
├── ui/                   # shadcn/ui components
└── booking/              # Date picker, booking widgets
```

## 🛠️ Tech Stack

| Category       | Technology              |
| -------------- | ----------------------- |
| Framework      | Next.js 16 (App Router) |
| Language       | TypeScript 5            |
| Styling        | Tailwind CSS 4          |
| UI Components  | Radix UI, shadcn/ui     |
| Animations     | Framer Motion           |
| Forms          | Zod validation          |
| HTTP Client    | Axios                   |
| Email          | Resend                  |
| Security       | Cloudflare Turnstile    |
| PDF Generation | jsPDF                   |
| Date Handling  | date-fns                |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/patwikx/new-twc-website.git
cd new-twc-website

# Install dependencies
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Resend Email (required for contact form)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxx

# Cloudflare Turnstile (required for bot protection)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAxxxxxxxxxx
TURNSTILE_SECRET_KEY=0x4AAAAAxxxxxxxxxx
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm start
```

## 📧 Email Configuration

The contact form sends two emails via Resend:

1. **Admin Notification** → `patricklacapmiranda@gmail.com`
2. **Guest Auto-Reply** → User's email address

Emails are sent from `no-reply@doloreshotels.com` (requires verified domain in Resend).

## 🔒 Security

- **Cloudflare Turnstile** – Invisible CAPTCHA on contact and booking forms
- **Server-side Validation** – Zod schema validation on all API routes
- **Environment Variables** – Sensitive keys stored securely

## 🌐 Deployment

Deployed on Cloudflare Pages. The site is configured to work with:

- Cloudflare DNS
- Cloudflare Bot Fight Mode
- Cloudflare Rate Limiting

## 📄 License

Private repository. All rights reserved.

---

**Developed for Tropicana Worldwide Corporation**
