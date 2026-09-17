export function cleanMarkdown(text: string): string {
  if (!text) return "";
  let clean = text;

  // Code blocks: ```...```
  clean = clean.replace(/```[\s\S]*?```/g, (match) => {
    const lines = match.split("\n");
    if (lines.length > 2) {
      return lines.slice(1, -1).join("\n");
    }
    return match.replace(/```[a-z]*/gi, "").replace(/```/g, "");
  });

  // Inline code: `code`
  clean = clean.replace(/`([^`]+)`/g, "$1");

  // Images: ![alt](url) -> ""
  clean = clean.replace(/!\[([^\]]*)\]\([^)]+\)/g, "");

  // Links: [text](url) -> text
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Headers: # Header, ## Header at start of line
  clean = clean.replace(/^[ \t]*#{1,6}[ \t]+(.*)$/gm, "$1");

  // Blockquotes: > quote
  clean = clean.replace(/^[ \t]*>[ \t]?(.*)$/gm, "$1");

  // Horizontal rules: ---, ***, ___
  clean = clean.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, "");

  // Unordered list items: * item, - item, + item
  clean = clean.replace(/^[ \t]*[*+-][ \t]+(.*)$/gm, "$1");

  // Ordered list items: 1. item, 2) item
  clean = clean.replace(/^[ \t]*\d+[\.\)][ \t]+(.*)$/gm, "$1");

  // Bold / Italic / Strikethrough combinations
  clean = clean.replace(/(\*{3}|_{3})(.*?)\1/g, "$2");
  clean = clean.replace(/(\*{2}|_{2})(.*?)\1/g, "$2");
  clean = clean.replace(/(\*|_)(.*?)\1/g, "$2");
  clean = clean.replace(/~~(.*?)~~/g, "$1");

  // Clean up extra blank lines
  clean = clean.replace(/\n{3,}/g, "\n\n");

  return clean.trim();
}

export function hasMarkdown(text: string): boolean {
  if (!text || !text.trim()) return false;
  const cleaned = cleanMarkdown(text);
  return text.trim() !== cleaned;
}
