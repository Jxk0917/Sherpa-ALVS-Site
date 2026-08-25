export default function (eleventyConfig) {
  // Images, the extracted styles.css/main.js, and the icon sprite all live
  // under src/assets/ and pass through untouched — Eleventy only processes
  // *.html/*.njk, everything else in the input tree is copied as-is unless
  // explicitly added here.
  eleventyConfig.addPassthroughCopy("src/assets");

  // GitHub Pages reads the custom domain from a CNAME file at the site
  // root, so it has to survive the build as a literal copy.
  eleventyConfig.addPassthroughCopy("src/CNAME");

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
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v));

  return {
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
