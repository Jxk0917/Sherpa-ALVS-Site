import { HtmlBasePlugin } from "@11ty/eleventy";

// Where the site will be served from. The pages link root-absolutely, so
// serving from anywhere other than a domain root needs every URL rewritten.
// "/" is the real deployment (alpha.sherpa.com); the GitHub Pages project
// URL lives under /Sherpa-ALVS-Site/ and is set via the environment, so
// switching targets never means editing this file.
// Accepted bare ("Sherpa-ALVS-Site") or slashed ("/Sherpa-ALVS-Site/") and
// normalised to the latter. Bare is what CI passes: a leading slash makes
// Git Bash rewrite the value into a Windows path before Node ever sees it.
const RAW = process.env.PATH_PREFIX || "/";
const PATH_PREFIX =
  RAW === "/" ? "/" : "/" + RAW.replace(new RegExp("^/+|/+$", "g"), "") + "/";

// Prefix without its trailing slash, so joins below never double the "/".
const PREFIX = PATH_PREFIX === "/" ? "" : PATH_PREFIX.slice(0, -1);

// HtmlBasePlugin rewrites href/src in rendered HTML, but it cannot see
// inside a <script> tag. product.njk ships its variants as a JSON blob the
// PDP parses at runtime to swap photos, so those paths have to be walked
// and prefixed by hand or every variant image 404s under a path prefix.
function prefixUrls(value) {
  if (typeof value === "string") {
    return value.startsWith("/") && !value.startsWith("//")
      ? PREFIX + value
      : value;
  }
  if (Array.isArray(value)) return value.map(prefixUrls);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, prefixUrls(v)])
    );
  }
  return value;
}

export default function (eleventyConfig) {
  // Rewrites root-absolute href/src/srcset in output HTML to sit under
  // pathPrefix. Without it pathPrefix only affects the `url` filter, and
  // every hand-written /assets/... link stays broken.
  eleventyConfig.addPlugin(HtmlBasePlugin);

  // Images, the extracted styles.css/main.js, and the icon sprite all live
  // under src/assets/ and pass through untouched — Eleventy only processes
  // *.html/*.njk, everything else in the input tree is copied as-is unless
  // explicitly added here.
  eleventyConfig.addPassthroughCopy("src/assets");

  // GitHub Pages reads the custom domain from a CNAME file at the site
  // root, so it has to survive the build as a literal copy — but only for
  // the root deploy. Shipping it in a path-prefixed build would hand Pages
  // a custom domain while the URLs are built for the project subpath.
  if (PATH_PREFIX === "/") {
    eleventyConfig.addPassthroughCopy("src/CNAME");
  }

  // Money, rendered from the one place that knows the placeholder rule:
  // a null price has not been supplied yet and must read as unfinished
  // rather than as free.
  eleventyConfig.addFilter("price", (v) =>
    typeof v === "number" ? "$" + v.toFixed(2) : "$XX.XX"
  );

  // "5, 10 and 25 mg" rather than "5, 10, 25". Used wherever a dose list
  // is read as a sentence instead of as picker options.
  eleventyConfig.addFilter("doseList", (arr) => {
    if (!Array.isArray(arr) || !arr.length) return "";
    if (arr.length === 1) return arr[0] + " mg";
    return arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1] + " mg";
  });

  eleventyConfig.addFilter("byFamily", (products, slug) =>
    (products || []).filter((p) => p.family === slug)
  );

  eleventyConfig.addFilter("find", (arr, key, value) =>
    (arr || []).find((x) => x[key] === value)
  );

  // Feeds the per-variant data blob a product page's own script reads at
  // runtime to swap photo/price/specs by strength, without a second
  // network request or a duplicate copy of the data in the page.
  eleventyConfig.addFilter("json", (v) => JSON.stringify(prefixUrls(v)));

  return {
    pathPrefix: PATH_PREFIX,

    // The layouts are Nunjucks, so the page templates are too. Without
    // this, *.html files parse as Liquid and the {% for %} loops that
    // build the shop grids silently render nothing.
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
  };
}
