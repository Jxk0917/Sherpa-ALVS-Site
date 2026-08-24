export default function (eleventyConfig) {
  // Images, the extracted styles.css/main.js, and the icon sprite all live
  // under src/assets/ and pass through untouched — Eleventy only processes
  // *.html/*.njk, everything else in the input tree is copied as-is unless
  // explicitly added here.
  eleventyConfig.addPassthroughCopy("src/assets");

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
  };
}
