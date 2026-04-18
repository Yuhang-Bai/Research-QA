import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: false
});

const ENVIRONMENT_MAP = {
    theorem: 'theorem',
    thm: 'theorem',
    lemma: 'lemma',
    lem: 'lemma',
    definition: 'definition',
    defn: 'definition',
    conjecture: 'conjecture',
    conj: 'conjecture',
    problem: 'problem',
    proof: 'proof'
};

const SECTION_COMMANDS = {
    h1: 'section',
    h2: 'subsection',
    h3: 'subsubsection',
    h4: 'paragraph',
    h5: 'subparagraph',
    h6: 'subparagraph'
};

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeLatexText(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/([&%#$])/g, '\\$1')
        .replace(/_/g, '\\_')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}');
}

function escapeLatexUrl(value) {
    return String(value ?? '')
        .replace(/\\/g, '/')
        .replace(/([%#&{}_])/g, '\\$1');
}

function stripHtml(value) {
    return String(value ?? '').replace(/<[^>]+>/g, ' ');
}

function consumeBalanced(source, startIndex, openChar, closeChar) {
    if (source[startIndex] !== openChar) {
        return null;
    }

    let depth = 0;
    for (let index = startIndex; index < source.length; index += 1) {
        const char = source[index];
        if (char === '\\') {
            index += 1;
            continue;
        }
        if (char === openChar) {
            depth += 1;
        } else if (char === closeChar) {
            depth -= 1;
            if (depth === 0) {
                return source.slice(startIndex, index + 1);
            }
        }
    }

    return null;
}

function consumeLatexCommand(source, index) {
    if (source.startsWith('\\\\', index)) {
        return '\\\\';
    }

    const commandMatch = source.slice(index).match(/^\\[a-zA-Z@]+[*]?/);
    if (!commandMatch) {
        const singleChar = source.slice(index).match(/^\\./);
        return singleChar ? singleChar[0] : null;
    }

    let cursor = index + commandMatch[0].length;
    while (cursor < source.length) {
        if (source[cursor] === '[') {
            const segment = consumeBalanced(source, cursor, '[', ']');
            if (!segment) {
                break;
            }
            cursor += segment.length;
            continue;
        }

        if (source[cursor] === '{') {
            const segment = consumeBalanced(source, cursor, '{', '}');
            if (!segment) {
                break;
            }
            cursor += segment.length;
            continue;
        }

        break;
    }

    return source.slice(index, cursor);
}

function createProtector() {
    const placeholders = [];

    const store = (segment) => {
        const token = `RQLATEXSEG${placeholders.length}Q`;
        placeholders.push(segment);
        return token;
    };

    const protectEnvironments = (source) => {
        let output = '';
        for (let index = 0; index < source.length;) {
            if (source.startsWith('\\begin{', index)) {
                const match = source.slice(index).match(/^\\begin\{([^}]+)\}/);
                if (match) {
                    const endToken = `\\end{${match[1]}}`;
                    const closeIndex = source.indexOf(endToken, index + match[0].length);
                    if (closeIndex !== -1) {
                        output += store(source.slice(index, closeIndex + endToken.length));
                        index = closeIndex + endToken.length;
                        continue;
                    }
                }
            }

            output += source[index];
            index += 1;
        }

        return output;
    };

    const protectMath = (source) => {
        let output = '';
        for (let index = 0; index < source.length;) {
            if (source.startsWith('$$', index)) {
                const closeIndex = source.indexOf('$$', index + 2);
                if (closeIndex !== -1) {
                    output += store(source.slice(index, closeIndex + 2));
                    index = closeIndex + 2;
                    continue;
                }
            }

            if (source.startsWith('\\(', index)) {
                const closeIndex = source.indexOf('\\)', index + 2);
                if (closeIndex !== -1) {
                    output += store(source.slice(index, closeIndex + 2));
                    index = closeIndex + 2;
                    continue;
                }
            }

            if (source.startsWith('\\[', index)) {
                const closeIndex = source.indexOf('\\]', index + 2);
                if (closeIndex !== -1) {
                    output += store(source.slice(index, closeIndex + 2));
                    index = closeIndex + 2;
                    continue;
                }
            }

            if (source[index] === '$' && source[index - 1] !== '\\') {
                const closeIndex = source.indexOf('$', index + 1);
                if (closeIndex !== -1 && source[closeIndex - 1] !== '\\') {
                    output += store(source.slice(index, closeIndex + 1));
                    index = closeIndex + 1;
                    continue;
                }
            }

            output += source[index];
            index += 1;
        }

        return output;
    };

    const protectCommands = (source) => {
        let output = '';
        for (let index = 0; index < source.length;) {
            if (source[index] === '\\') {
                const command = consumeLatexCommand(source, index);
                if (command) {
                    output += store(command);
                    index += command.length;
                    continue;
                }
            }

            output += source[index];
            index += 1;
        }

        return output;
    };

    return {
        protect(source) {
            return protectCommands(protectMath(protectEnvironments(source)));
        },
        restore(source) {
            return placeholders.reduce(
                (current, segment, index) => current.replaceAll(`RQLATEXSEG${index}Q`, segment),
                source
            );
        }
    };
}

function splitBlocks(source) {
    const blocks = [];
    const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
    let buffer = [];

    const flushBuffer = () => {
        if (buffer.length > 0) {
            blocks.push({ type: 'markdown', source: buffer.join('\n') });
            buffer = [];
        }
    };

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        const startMatch = line.match(/^\s*\\begin\{(theorem|thm|lemma|lem|definition|defn|conjecture|conj|problem|proof)\}\s*(.*)$/i);
        if (!startMatch) {
            buffer.push(line);
            continue;
        }

        const alias = startMatch[1].toLowerCase();
        const endPattern = new RegExp(`^\\s*\\\\end\\{${escapeRegExp(alias)}\\}\\s*(.*)$`, 'i');
        const nestedPattern = new RegExp(`^\\s*\\\\begin\\{${escapeRegExp(alias)}\\}\\b`, 'i');
        const collected = [];
        let depth = 1;

        if (startMatch[2]) {
            collected.push(startMatch[2]);
        }

        let cursor = lineIndex + 1;
        for (; cursor < lines.length; cursor += 1) {
            const candidate = lines[cursor];

            if (nestedPattern.test(candidate)) {
                depth += 1;
            }

            const endMatch = candidate.match(endPattern);
            if (endMatch) {
                depth -= 1;
                if (depth === 0) {
                    if (endMatch[1]) {
                        collected.push(endMatch[1]);
                    }
                    break;
                }
            }

            collected.push(candidate);
        }

        if (cursor >= lines.length) {
            buffer.push(line);
            continue;
        }

        flushBuffer();
        blocks.push({
            type: 'environment',
            env: ENVIRONMENT_MAP[alias],
            source: collected.join('\n').trim()
        });
        lineIndex = cursor;
    }

    flushBuffer();
    return blocks.filter((block) => block.source.trim());
}

function renderInlineTokens(tokens = []) {
    let output = '';
    const linkStack = [];

    for (const token of tokens) {
        switch (token.type) {
        case 'text':
            output += escapeLatexText(token.content);
            break;
        case 'softbreak':
            output += '\n';
            break;
        case 'hardbreak':
            output += '\\\\\n';
            break;
        case 'code_inline':
            output += `\\texttt{${escapeLatexText(token.content)}}`;
            break;
        case 'em_open':
            output += '\\emph{';
            break;
        case 'em_close':
            output += '}';
            break;
        case 'strong_open':
            output += '\\textbf{';
            break;
        case 'strong_close':
            output += '}';
            break;
        case 's_open':
            output += '\\textit{';
            break;
        case 's_close':
            output += '}';
            break;
        case 'link_open':
            linkStack.push(token.attrGet('href') || '');
            output += `\\href{${escapeLatexUrl(token.attrGet('href') || '')}}{`;
            break;
        case 'link_close':
            linkStack.pop();
            output += '}';
            break;
        case 'image':
            output += token.content ? `\\textit{${escapeLatexText(token.content)}}` : '';
            break;
        case 'html_inline':
            output += escapeLatexText(stripHtml(token.content));
            break;
        default:
            if (token.children?.length) {
                output += renderInlineTokens(token.children);
            } else if (token.content) {
                output += escapeLatexText(token.content);
            }
            break;
        }
    }

    while (linkStack.length > 0) {
        linkStack.pop();
        output += '}';
    }

    return output;
}

function normalizeListItemContent(source) {
    const value = source.trim().replace(/\n{3,}/g, '\n\n');
    return value || ' ';
}

function renderCodeBlock(content) {
    const body = String(content ?? '').replace(/\r\n?/g, '\n');
    return `\\begin{verbatim}\n${body}\n\\end{verbatim}\n`;
}

function renderTokenRange(tokens, startIndex = 0, stopType = '') {
    let output = '';
    let index = startIndex;

    while (index < tokens.length) {
        const token = tokens[index];
        if (stopType && token.type === stopType) {
            return { latex: output, nextIndex: index + 1 };
        }

        switch (token.type) {
        case 'heading_open': {
            const inlineToken = tokens[index + 1];
            const command = SECTION_COMMANDS[token.tag] || 'paragraph';
            const title = renderInlineTokens(inlineToken?.children || []);
            output += `\n\\${command}{${title}}\n`;
            index += 3;
            break;
        }
        case 'paragraph_open': {
            let paragraph = '';
            index += 1;
            while (index < tokens.length && tokens[index].type !== 'paragraph_close') {
                const inner = tokens[index];
                if (inner.type === 'inline') {
                    paragraph += renderInlineTokens(inner.children || []);
                } else if (inner.content) {
                    paragraph += escapeLatexText(inner.content);
                }
                index += 1;
            }
            output += `\n${paragraph.trim()}\n`;
            index += 1;
            break;
        }
        case 'bullet_list_open': {
            const rendered = renderTokenRange(tokens, index + 1, 'bullet_list_close');
            output += `\n\\begin{itemize}\n${rendered.latex}\\end{itemize}\n`;
            index = rendered.nextIndex;
            break;
        }
        case 'ordered_list_open': {
            const rendered = renderTokenRange(tokens, index + 1, 'ordered_list_close');
            output += `\n\\begin{enumerate}\n${rendered.latex}\\end{enumerate}\n`;
            index = rendered.nextIndex;
            break;
        }
        case 'list_item_open': {
            const rendered = renderTokenRange(tokens, index + 1, 'list_item_close');
            output += `\\item ${normalizeListItemContent(rendered.latex)}\n`;
            index = rendered.nextIndex;
            break;
        }
        case 'blockquote_open': {
            const rendered = renderTokenRange(tokens, index + 1, 'blockquote_close');
            output += `\n\\begin{quote}\n${rendered.latex}\\end{quote}\n`;
            index = rendered.nextIndex;
            break;
        }
        case 'inline':
            output += renderInlineTokens(token.children || []);
            index += 1;
            break;
        case 'fence':
        case 'code_block':
            output += `\n${renderCodeBlock(token.content)}\n`;
            index += 1;
            break;
        case 'hr':
            output += '\n\\medskip\\hrule\\medskip\n';
            index += 1;
            break;
        case 'html_block':
            output += `\n${escapeLatexText(stripHtml(token.content))}\n`;
            index += 1;
            break;
        default:
            index += 1;
            break;
        }
    }

    return { latex: output, nextIndex: index };
}

function markdownToLatex(source) {
    const protector = createProtector();
    const protectedSource = protector.protect(String(source ?? '').trim());
    if (!protectedSource.trim()) {
        return '';
    }

    const tokens = markdown.parse(protectedSource, {});
    const rendered = renderTokenRange(tokens).latex
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return protector.restore(rendered);
}

function inlineMarkdownToLatex(source) {
    const protector = createProtector();
    const protectedSource = protector.protect(String(source ?? '').trim());
    if (!protectedSource) {
        return '';
    }

    const inlineToken = markdown.parseInline(protectedSource, {})[0];
    const rendered = renderInlineTokens(inlineToken?.children || []);
    return protector.restore(rendered);
}

function renderSourceToLatex(source) {
    const blocks = splitBlocks(source);
    if (!blocks.length) {
        return '';
    }

    return blocks.map((block) => {
        if (block.type === 'environment') {
            const body = markdownToLatex(block.source);
            return `\\begin{${block.env}}\n${body}\n\\end{${block.env}}`;
        }

        return markdownToLatex(block.source);
    }).filter(Boolean).join('\n\n');
}

function formatNoteDate(dateString) {
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) {
        return String(dateString ?? '');
    }

    return parsed.toISOString().replace('T', ' ').slice(0, 16);
}

export function buildProblemLatexDocument(item, options = {}) {
    const title = inlineMarkdownToLatex(item?.title || 'Untitled problem') || 'Untitled problem';
    const statement = renderSourceToLatex(item?.desc || '') || '\\emph{No statement provided.}';
    const preamble = String(item?.preamble || '').trim();
    const language = options.language === 'zh' ? 'zh' : 'en';
    const updatedLabel = language === 'zh' ? 'Updated' : 'Updated';
    const statementLabel = language === 'zh' ? 'Problem Statement' : 'Problem Statement';
    const notesLabel = language === 'zh' ? 'Research Notes' : 'Research Notes';
    const emptyNotesLabel = language === 'zh' ? 'No research notes yet.' : 'No research notes yet.';

    const notes = Array.isArray(item?.answers) ? item.answers : [];
    const notesBody = notes.length
        ? notes.map((note, index) => {
            const body = renderSourceToLatex(note?.text || '') || '\\emph{Empty note.}';
            return [
                `\\subsection*{Note ${index + 1}}`,
                `\\textit{${escapeLatexText(formatNoteDate(note?.date))}}`,
                '',
                body
            ].join('\n');
        }).join('\n\n')
        : `\\emph{${emptyNotesLabel}}`;

    return String.raw`\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage{iftex}
\ifPDFTeX
  \usepackage[T1]{fontenc}
  \usepackage[utf8]{inputenc}
  \usepackage{lmodern}
\else
  \usepackage{fontspec}
  \defaultfontfeatures{Ligatures=TeX}
\fi
\usepackage{amsmath,amssymb,amsthm,mathtools}
\usepackage{xcolor}
\usepackage[colorlinks=true,linkcolor=blue!60!black,urlcolor=blue!60!black]{hyperref}
\IfFileExists{bm.sty}{\usepackage{bm}}{}
\IfFileExists{cancel.sty}{\usepackage{cancel}}{}
\IfFileExists{physics.sty}{\usepackage{physics}}{}
\IfFileExists{mhchem.sty}{\usepackage[version=4]{mhchem}}{}
\IfFileExists{enumitem.sty}{%
  \usepackage{enumitem}
  \setlist[itemize]{leftmargin=1.6em}
  \setlist[enumerate]{leftmargin=1.8em}
}{}
\IfFileExists{parskip.sty}{%
  \usepackage{parskip}
}{%
  \setlength{\parindent}{0pt}
  \setlength{\parskip}{0.6em}
}
\newtheorem{theorem}{Theorem}
\newtheorem{lemma}{Lemma}
\newtheorem{definition}{Definition}
\newtheorem{conjecture}{Conjecture}
\newtheorem{problem}{Problem}
${preamble}
\begin{document}
\begin{center}
{\LARGE ${title}}\\[0.35em]
{\small ${updatedLabel}: ${escapeLatexText(formatNoteDate(item?.date || new Date().toISOString()))}}
\end{center}

\section*{${statementLabel}}
${statement}

\section*{${notesLabel}}
${notesBody}

\end{document}
`;
}
