const isEditorNode = (editor: HTMLElement, node: Node): boolean => (
  node === editor || editor.contains(node)
);

export const normalizeRichTextLinkUrl = (value: string): string | null => {
  const url = value.trim();
  if (!url || /[\u0000-\u001f\u007f]/.test(url)) return null;

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      return parsed.hostname ? parsed.href : null;
    } catch {
      return null;
    }
  }

  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(url)) return url;
  if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) return url;
  if (url.startsWith('#')) return url;
  return null;
};

const setAnchorDestination = (anchor: HTMLAnchorElement, href: string): void => {
  anchor.setAttribute('href', href);
  if (/^https?:\/\//i.test(href)) {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
  } else {
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
  }
};

export const applyRichTextLink = (
  editor: HTMLElement,
  range: Range,
  href: string,
): boolean => {
  if (range.collapsed
    || !isEditorNode(editor, range.startContainer)
    || !isEditorNode(editor, range.endContainer)
    || !range.toString().trim()) {
    return false;
  }

  const commonNode = range.commonAncestorContainer;
  const commonElement = commonNode instanceof Element ? commonNode : commonNode.parentElement;
  const existingAnchor = commonElement?.closest('a');
  if (existingAnchor && editor.contains(existingAnchor)) {
    setAnchorDestination(existingAnchor, href);
    return true;
  }

  const fragment = range.extractContents();
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  let wrappedText = false;
  textNodes.forEach((textNode) => {
    if (!textNode.data.trim()) return;
    const parentAnchor = textNode.parentElement?.closest('a');
    if (parentAnchor) {
      setAnchorDestination(parentAnchor, href);
      wrappedText = true;
      return;
    }

    const anchor = document.createElement('a');
    setAnchorDestination(anchor, href);
    textNode.replaceWith(anchor);
    anchor.append(textNode);
    wrappedText = true;
  });

  if (!wrappedText) return false;
  range.insertNode(fragment);
  return true;
};
