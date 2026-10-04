import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

async function generateAllFaviconAssets() {
  const svgPath = path.join(process.cwd(), 'public', 'favicon.svg')
  const publicDir = path.join(process.cwd(), 'public')
  const svgBuffer = fs.readFileSync(svgPath)

  console.log('Generating PNG favicon sizes from SVG...')

  // 1. Generate 96x96 PNG
  await sharp(svgBuffer)
    .resize(96, 96)
    .png()
    .toFile(path.join(publicDir, 'favicon-96x96.png'))
  console.log('✓ Created favicon-96x96.png')

  // 2. Generate 180x180 Apple Touch Icon
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'))
  console.log('✓ Created apple-touch-icon.png')

  // 3. Generate 192x192 Web App Manifest Icon
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'web-app-manifest-192x192.png'))
  console.log('✓ Created web-app-manifest-192x192.png')

  // 4. Generate 512x512 Web App Manifest Icon
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'web-app-manifest-512x512.png'))
  console.log('✓ Created web-app-manifest-512x512.png')

  // 5. Generate Multi-Resolution ICO File (16x16, 32x32, 48x48)
  const sizes = [16, 32, 48]
  const pngBuffers = await Promise.all(
    sizes.map(size => sharp(svgBuffer).resize(size, size).png().toBuffer())
  )

  // Construct standard Windows ICO format with embedded PNGs (supported by all modern OS/browsers)
  const count = pngBuffers.length
  const headerSize = 6
  const dirEntrySize = 16
  const dirSize = count * dirEntrySize

  let currentOffset = headerSize + dirSize
  const dirEntries: Buffer[] = []

  for (let i = 0; i < count; i++) {
    const size = sizes[i]
    const buf = pngBuffers[i]
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size === 256 ? 0 : size, 0) // width
    entry.writeUInt8(size === 256 ? 0 : size, 1) // height
    entry.writeUInt8(0, 2) // color count
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(buf.length, 8) // size of image data
    entry.writeUInt32LE(currentOffset, 12) // offset
    dirEntries.push(entry)
    currentOffset += buf.length
  }

  // Header: 2 bytes reserved (0), 2 bytes type (1 for ICO), 2 bytes image count
  const icoHeader = Buffer.alloc(6)
  icoHeader.writeUInt16LE(0, 0)
  icoHeader.writeUInt16LE(1, 2)
  icoHeader.writeUInt16LE(count, 4)

  const finalIcoBuffer = Buffer.concat([icoHeader, ...dirEntries, ...pngBuffers])
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), finalIcoBuffer)
  fs.writeFileSync(path.join(process.cwd(), 'app', 'favicon.ico'), finalIcoBuffer)
  console.log('✓ Created multi-resolution favicon.ico')

  // Update site.webmanifest with standard PWA manifest icons
  const manifest = {
    name: "GhostCRM - Persian Team Management",
    short_name: "GhostCRM",
    description: "Secure Telegram-Ingested Bilingual CRM & Courier Call Masking System",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ],
    theme_color: "#0F172A",
    background_color: "#0B0F19",
    display: "standalone"
  }

  fs.writeFileSync(path.join(publicDir, 'site.webmanifest'), JSON.stringify(manifest, null, 2), 'utf8')
  console.log('✓ Updated site.webmanifest')
}

generateAllFaviconAssets().catch(err => {
  console.error('Failed to generate favicon assets:', err)
  process.exit(1)
})
