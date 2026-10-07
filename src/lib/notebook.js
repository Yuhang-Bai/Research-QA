import MarkdownIt from 'markdown-it';

const metadataMarkdown = new MarkdownIt({ html: false, linkify: true });

// Notebook navigation metadata is derived from Markdown; stored records stay unchanged.
export function contentTags(item) {
    const source = [item?.desc || '', ...(item?.answers || []).map(note => note.text || '')].join('\n');
    const prose = source.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, '');
    return [...new Set([...prose.matchAll(/(?:^|\s)#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu)].map(match => match[1]))].slice(0, 40);
}

export function contentReferences(item) {
    const source = [item?.desc || '', ...(item?.answers || []).map(note => note.text || '')].join('\n');
    const links = new Map();
    // Reuse Markdown's parser so code examples and balanced URL parentheses
    // are not mistaken for references or silently truncated.
    for (const block of metadataMarkdown.parse(source, {})) {
        const tokens = block.children || [];
        for (let index = 0; index < tokens.length; index++) {
            if (tokens[index].type !== 'link_open') continue;
            try {
                const url = new URL(tokens[index].attrGet('href'));
                if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue;
                let title = '';
                for (let cursor = index + 1; cursor < tokens.length && tokens[cursor].type !== 'link_close'; cursor++) {
                    if (['text', 'code_inline'].includes(tokens[cursor].type)) title += tokens[cursor].content;
                }
                if (!links.has(url.href)) links.set(url.href, { title: title || url.hostname, url: url.href });
            } catch { /* Invalid links are not references. */ }
            if (links.size === 20) return [...links.values()];
        }
    }
    return [...links.values()];
}

export function matchesLibraryFilter(item, filter) {
    if (filter === 'pinned') return Boolean(item.isPinned);
    if (filter === 'notes') return Boolean(item.answers?.length);
    if (filter === 'shared') return Boolean(item.shareId);
    return true;
}
