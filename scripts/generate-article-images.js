#!/usr/bin/env node

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Article themes and configurations
const articles = [
  {
    slug: '5-signes-urgence-electrique-paris',
    title: '5 Signes d&#39;Urgence',
    subtitle: 'Reconnaître les dangers',
    color: { start: '#dc2626', end: '#7f1d1d' }, // Red gradient for danger
    icon: '⚠️'
  },
  {
    slug: 'court-circuit-dangers-solutions',
    title: 'Court-Circuit',
    subtitle: 'Dangers et Solutions',
    color: { start: '#ea580c', end: '#991b1b' }, // Orange-red for electrical hazard
    icon: '⚡'
  },
  {
    slug: 'disjoncteur-qui-saute-sos-ou-reparation',
    title: 'Disjoncteur qui Saute',
    subtitle: 'SOS ou Réparation ?',
    color: { start: '#0891b2', end: '#164e63' }, // Cyan for technical
    icon: '🔌'
  },
  {
    slug: 'electricien-nuit-paris-service-24h',
    title: 'Service de Nuit',
    subtitle: 'Disponible 24h/24',
    color: { start: '#1e293b', end: '#020617' }, // Dark for night theme
    icon: '🌙'
  },
  {
    slug: 'electricien-paris-dimanche-intervention',
    title: 'Service Dimanche',
    subtitle: 'Week-end et Jours Fériés',
    color: { start: '#059669', end: '#064e3b' }, // Green for availability
    icon: '📅'
  },
  {
    slug: 'normes-electriques-paris-loi',
    title: 'Normes NF C 15-100',
    subtitle: 'Réglementation 2025',
    color: { start: '#1e40af', end: '#1e3a8a' }, // Blue for legal/official
    icon: '📋'
  },
  {
    slug: 'panne-totale-courant-que-faire',
    title: 'Panne Totale',
    subtitle: 'Que Faire ?',
    color: { start: '#374151', end: '#111827' }, // Gray for power outage
    icon: '🔦'
  },
  {
    slug: 'plus-courant-piece-diagnostic',
    title: 'Diagnostic Pièce',
    subtitle: 'Identifier la panne',
    color: { start: '#7c3aed', end: '#4c1d95' }, // Purple for diagnostic
    icon: '🔍'
  },
  {
    slug: 'prix-depannage-electricite-urgence-paris',
    title: 'Tarifs 2025',
    subtitle: 'Prix Transparents',
    color: { start: '#f59e0b', end: '#92400e' }, // Amber for pricing
    icon: '💶'
  },
  {
    slug: 'tableau-electrique-gresille-urgence',
    title: 'Tableau qui Grésille',
    subtitle: 'Urgence Absolue !',
    color: { start: '#ef4444', end: '#991b1b' }, // Bright red for emergency
    icon: '🔥'
  }
];

// Image dimensions
const dimensions = {
  hero: { width: 1920, height: 1080 },
  og: { width: 1200, height: 630 },
  thumbnail: { width: 800, height: 600 }
};

// Create output directories
async function createDirectories() {
  const dirs = [
    'static/images/articles',
    'static/images/articles/hero',
    'static/images/articles/og',
    'static/images/articles/thumbnail'
  ];

  for (const dir of dirs) {
    await fs.mkdir(path.join(__dirname, '..', dir), { recursive: true });
  }
}

// Generate a single image variant
async function generateImage(article, variant, dimensions) {
  const { width, height } = dimensions;

  // Create SVG with gradient background and text
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${article.color.start};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${article.color.end};stop-opacity:1" />
        </linearGradient>
        <pattern id="circuit" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M10 50 L30 50 M40 50 L60 50 M70 50 L90 50 M50 10 L50 30 M50 40 L50 60 M50 70 L50 90"
                stroke="white" stroke-width="0.5" opacity="0.1" fill="none"/>
          <circle cx="50" cy="50" r="3" fill="white" opacity="0.15"/>
          <circle cx="30" cy="50" r="2" fill="white" opacity="0.1"/>
          <circle cx="70" cy="50" r="2" fill="white" opacity="0.1"/>
          <circle cx="50" cy="30" r="2" fill="white" opacity="0.1"/>
          <circle cx="50" cy="70" r="2" fill="white" opacity="0.1"/>
        </pattern>
      </defs>

      <!-- Gradient Background -->
      <rect width="${width}" height="${height}" fill="url(#grad)"/>

      <!-- Circuit Pattern Overlay -->
      <rect width="${width}" height="${height}" fill="url(#circuit)"/>

      <!-- Dark overlay for text readability -->
      <rect width="${width}" height="${height}" fill="black" opacity="0.3"/>

      <!-- Icon -->
      <text x="${width/2}" y="${height/2 - 80}"
            font-family="Arial" font-size="${variant === 'thumbnail' ? '60' : '80'}"
            text-anchor="middle" fill="white" opacity="0.9">
        ${article.icon}
      </text>

      <!-- Title -->
      <text x="${width/2}" y="${height/2 + 20}"
            font-family="Arial, sans-serif" font-size="${variant === 'thumbnail' ? '42' : '56'}"
            font-weight="bold" text-anchor="middle" fill="white">
        ${article.title}
      </text>

      <!-- Subtitle -->
      <text x="${width/2}" y="${height/2 + 70}"
            font-family="Arial, sans-serif" font-size="${variant === 'thumbnail' ? '24' : '32'}"
            text-anchor="middle" fill="white" opacity="0.9">
        ${article.subtitle}
      </text>

      <!-- Brand -->
      <text x="${width/2}" y="${height - 40}"
            font-family="Arial, sans-serif" font-size="20"
            text-anchor="middle" fill="white" opacity="0.7">
        SOS Électricien Paris - ☎️ 06 44 64 48 24
      </text>

      <!-- Emergency badge for hero images -->
      ${variant === 'hero' ? `
        <rect x="40" y="40" width="200" height="60" rx="30" fill="white" opacity="0.95"/>
        <text x="140" y="75" font-family="Arial, sans-serif" font-size="20"
              font-weight="bold" text-anchor="middle" fill="${article.color.start}">
          URGENCE 24/7
        </text>
      ` : ''}
    </svg>
  `;

  // Convert SVG to PNG using Sharp
  const buffer = await sharp(Buffer.from(svg))
    .png({ quality: 90, compressionLevel: 9 })
    .toBuffer();

  return buffer;
}

// Generate WebP version
async function generateWebP(buffer, dimensions) {
  return await sharp(buffer)
    .resize(dimensions.width, dimensions.height)
    .webp({ quality: 85 })
    .toBuffer();
}

// Main function
async function main() {
  console.log('🎨 Starting article image generation...\n');

  // Create directories
  await createDirectories();

  // Generate images for each article
  for (const article of articles) {
    console.log(`📝 Generating images for: ${article.title}`);

    for (const [variant, dims] of Object.entries(dimensions)) {
      // Generate PNG
      const pngBuffer = await generateImage(article, variant, dims);
      const pngPath = path.join(
        __dirname,
        '..',
        'static',
        'images',
        'articles',
        variant,
        `${article.slug}.png`
      );
      await fs.writeFile(pngPath, pngBuffer);

      // Generate WebP
      const webpBuffer = await generateWebP(pngBuffer, dims);
      const webpPath = path.join(
        __dirname,
        '..',
        'static',
        'images',
        'articles',
        variant,
        `${article.slug}.webp`
      );
      await fs.writeFile(webpPath, webpBuffer);

      console.log(`  ✅ ${variant}: PNG (${Math.round(pngBuffer.length/1024)}KB) + WebP (${Math.round(webpBuffer.length/1024)}KB)`);
    }

    console.log('');
  }

  console.log('✨ All images generated successfully!');
  console.log(`📁 Images saved to: static/images/articles/`);

  // Generate frontmatter snippet
  console.log('\n📄 Add this to your article frontmatter:\n');
  console.log('images:');
  console.log('  hero: "/images/articles/hero/[article-slug].webp"');
  console.log('  og: "/images/articles/og/[article-slug].png"');
  console.log('  thumbnail: "/images/articles/thumbnail/[article-slug].webp"');
}

// Run the script
main().catch(console.error);