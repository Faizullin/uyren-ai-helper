const remotePatterns = [
    { protocol: "https", hostname: "**" }
];
  
/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@workspace/ui", "@workspace/components-library"],
    images: { remotePatterns },
    // i18n: {
    //     locales: ["en", "ru", "kz"],
    //     defaultLocale: "en",
    //     localeDetection: false,
    // },
    turbopack: {
        rules: {
            '*.svg': {
              loaders: ['@svgr/webpack'],
              as: '*.js',
            },
          }, 
    },
    webpack: (config) => {
        config.module.rules.push({
            test: /\.svg$/,
            use: ['@svgr/webpack'],
        });
        return config;
    },
    // Enable standalone output for Docker
    output: process.env.NEXT_FOR_DOCKER ? 'standalone' : undefined,
};

export default nextConfig;