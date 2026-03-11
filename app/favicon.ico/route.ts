export async function GET() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill="#0a4dff" />
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="30" font-family="Arial" fill="#ffffff">SM</text>
    </svg>
  `.trim();

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
