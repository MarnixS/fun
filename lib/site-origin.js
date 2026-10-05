'use strict';

const LEGACY_ORIGIN = 'https://marnixs.github.io';
const CUSTOM_ORIGINS = new Set(['https://ugimps.com', 'https://www.ugimps.com']);

function isAllowedOrigin(origin) {
  return origin === LEGACY_ORIGIN || (
    process.env.UGIMPS_DOMAIN_ENABLED === 'true' && CUSTOM_ORIGINS.has(origin)
  );
}

function setOriginHeader(req, res) {
  const origin = req.headers?.origin;
  res.setHeader('Vary', 'Origin');
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
}

module.exports = { LEGACY_ORIGIN, isAllowedOrigin, setOriginHeader };
