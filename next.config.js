/* eslint-disable */
const withLess = require('@zeit/next-less')
const withImages = require('next-images')

// fix: prevents error when .less files are required by node
if (typeof require !== 'undefined') {
  require.extensions['.less'] = (file) => {}
}

module.exports = withImages(withLess({
  lessLoaderOptions: {
    javascriptEnabled: true,
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      issuer: {
        test: /\.(js|ts)x?$/,
      },
      use: ['@svgr/webpack'],
    });
    return config;
  },
}))