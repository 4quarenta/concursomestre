import { describe, expect, it } from "vitest";
import { toBlogArticleHtml } from "./blogHtml";

describe("toBlogArticleHtml", () => {
  it("uses formatted HTML from the article", () => {
    expect(toBlogArticleHtml("<h2>Título</h2><p><strong>Texto</strong></p>", "plain"))
      .toBe("<h2>Título</h2><p><strong>Texto</strong></p>");
  });

  it("escapes plain text and keeps paragraph and line breaks", () => {
    expect(toBlogArticleHtml(null, "A <notícia>\ncontinua\n\nOutro parágrafo"))
      .toBe("<p>A &lt;notícia&gt;<br />continua</p><p>Outro parágrafo</p>");
  });

  it("returns an empty string when the article has no body", () => {
    expect(toBlogArticleHtml("  ", null)).toBe("");
  });
});
