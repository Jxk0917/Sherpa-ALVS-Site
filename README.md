# Sherpa — ALVS Site

Static marketing + catalog site for the Sherpa hemp/THC brand, built with
[Eleventy](https://www.11ty.dev/). 33 pages: homepage, six product family
pages, per-product pages with variant switching, plus company/legal stubs.

## Local development

```bash
npm install
npm run build     # one-off build into _site/
npm run serve     # Eleventy dev server with live reload
```

Requires Node 22+.

## Layout

```
src/
  _data/          products.json, families.json, site.json, stubs.json
  _includes/      layouts/ and components/ (nav, footer, icon sprite, …)
  assets/         css, js, fonts, and all generated product imagery
  shop/           family.njk + product.njk drive the catalog from _data
_site/            build output — generated, not committed
```

All page content is driven from `src/_data/products.json` and
`families.json`; the templates in `src/shop/` fan those out into the
catalog. Adding a product means editing the data, not the templates.

## Asset tooling

`gen-*.mjs` and `shot-*.mjs` generate the product imagery and page
screenshots. They depend on `canvas` and `puppeteer`, which resolve from
the parent workspace's `node_modules` rather than this package — they are
dev-only, and their output is committed under `src/assets/`, so the site
build and CI never invoke them.

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which builds with
Eleventy and publishes `_site/` to GitHub Pages.

Pages are linked with root-absolute paths (`/assets/styles.css`), so the
site must be served from a domain root. The custom domain lives in
`src/CNAME`, which Eleventy copies into the build output.
