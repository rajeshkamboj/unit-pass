/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 15 MB file + multipart metadata; file size is separately enforced by the action/bucket.
  experimental: { serverActions: { bodySizeLimit: '16mb' } },
};

export default nextConfig;
