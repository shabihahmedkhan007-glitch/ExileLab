/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ExileLab talks only to its own API (NEXT_PUBLIC_API_URL). No external hosts,
  // no image optimization against remote origins — compliance charter §7.5.
  images: { remotePatterns: [] },
};

export default nextConfig;
