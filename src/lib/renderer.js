import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';

const markdown = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true
}).use(taskLists, { enabled: true, label: true, labelAfter: true });

markdown.disable(['strikethrough']);

const ENVIRONMENT_MAP = {
    theorem: { canonical: 'theorem', title: 'Theorem', counter: 'theorem' },
    thm: { canonical: 'theorem', title: 'Theorem', counter: 'theorem' },
    lemma: { canonical: 'lemma', title: 'Lemma', counter: 'lemma' },
    lem: { canonical: 'lemma', title: 'Lemma', counter: 'lemma' },
    definition: { canonical: 'definition', title: 'Definition', counter: 'definition' },
    defn: { canonical: 'definition', title: 'Definition', counter: 'definition' },
    conjecture: { canonical: 'conjecture', title: 'Conjecture', counter: 'conjecture' },
    conj: { canonical: 'conjecture', title: 'Conjecture', counter: 'conjecture' },
    problem: { canonical: 'problem', title: 'Problem', counter: 'problem' },
    proof: { canonical: 'proof', title: 'Proof', counter: null }
};

const COUNTER_TEMPLATE = {
    theorem: 0,
    lemma: 0,
    definition: 0,
    conjecture: 0,
    problem: 0
};

const MATH_ENVIRONMENTS = [
    'align',
    'align*',
    'alignat',
    'alignat*',
    'equation',
    'equation*',
    'gather',
    'gather*',
    'multline',
    'multline*',
    'flalign',
    'flalign*',
    'eqnarray',
    'CD'
];

const FENCE_PATTERN = /^( {0,3})(`{3,}|~{3,})/;

let mathQueue = Promise.resolve();
let mathJaxReadyPromise = null;

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function injectPreamble(mathSource, preamble = '') {
    const setup = preamble.trim();
    const displayDollar = mathSource.startsWith('$$') && mathSource.endsWith('$$');
    if (displayDollar) {
        const body = mathSource.slice(2, -2).trim();
        return setup ? `\\[${setup}\n${body}\\]` : `\\[${body}\\]`;
    }

    if (!setup) {
        return mathSource;
    }

    if (mathSource.startsWith('$') && mathSource.endsWith('$')) {
        return `$${setup} ${mathSource.slice(1, -1)}$`;
    }

    if (mathSource.startsWith('\\(') && mathSource.endsWith('\\)')) {
        return `\\(${setup} ${mathSource.slice(2, -2)}\\)`;
    }

    if (mathSource.startsWith('\\[') && mathSource.endsWith('\\]')) {
        return `\\[${setup}\n${mathSource.slice(2, -2)}\\]`;
    }

    const environmentMatch = mathSource.match(/^\\begin\{([^}]+)\}/);
    if (environmentMatch && MATH_ENVIRONMENTS.includes(environmentMatch[1])) {
        return `${environmentMatch[0]}${setup}\n${mathSource.slice(environmentMatch[0].length)}`;
    }

    return `${setup}\n${mathSource}`;
}

function isEscaped(source, index) {
    let slashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) {
        slashCount += 1;
    }
    return slashCount % 2 === 1;
}

function countRun(source, index, character) {
    let cursor = index;
    while (source[cursor] === character) {
        cursor += 1;
    }
    return cursor - index;
}

function lineEnd(source, index) {
    const nextNewline = source.indexOf('\n', index);
    return nextNewline === -1 ? source.length : nextNewline;
}

function matchFenceStart(source, index) {
    if (index !== 0 && source[index - 1] !== '\n') {
        return null;
    }

    const line = source.slice(index, lineEnd(source, index));
    const match = line.match(FENCE_PATTERN);
    if (!match) {
        return null;
    }

    return {
        marker: match[2][0],
        length: match[2].length
    };
}

function findFenceEnd(source, index, fence) {
    let cursor = lineEnd(source, index);
    if (source[cursor] === '\n') {
        cursor += 1;
    }

    while (cursor < source.length) {
        const end = lineEnd(source, cursor);
        const line = source.slice(cursor, end);
        const closePattern = new RegExp(`^ {0,3}${escapeRegExp(fence.marker)}{${fence.length},}\\s*$`);
        if (closePattern.test(line)) {
            return source[end] === '\n' ? end + 1 : end;
        }
        cursor = source[end] === '\n' ? end + 1 : end;
    }

    return source.length;
}

function findInlineCodeEnd(source, index) {
    const length = countRun(source, index, '`');
    const token = '`'.repeat(length);
    const close = source.indexOf(token, index + length);
    return close === -1 ? index + length : close + length;
}

function findClosingDoubleDollar(source, index) {
    let cursor = index + 2;
    while (cursor < source.length) {
        const close = source.indexOf('$$', cursor);
        if (close === -1) {
            return -1;
        }
        if (!isEscaped(source, close)) {
            return close;
        }
        cursor = close + 2;
    }
    return -1;
}

function canOpenInlineDollar(source, index) {
    if (isEscaped(source, index)) {
        return false;
    }

    const next = source[index + 1];
    return Boolean(next && next !== '$' && !/\s/.test(next));
}

function canCloseInlineDollar(source, index) {
    if (isEscaped(source, index)) {
        return false;
    }

    const previous = source[index - 1];
    return Boolean(previous && !/\s/.test(previous));
}

function findClosingInlineDollar(source, index) {
    let cursor = index + 1;
    while (cursor < source.length) {
        if (source[cursor] === '`') {
            cursor = findInlineCodeEnd(source, cursor);
            continue;
        }

        if (source[cursor] === '$' && source[cursor + 1] !== '$' && canCloseInlineDollar(source, cursor)) {
            return cursor;
        }

        cursor += 1;
    }
    return -1;
}

function protectMath(source, preamble) {
    const placeholders = [];
    let output = '';
    let index = 0;

    const store = (math) => {
        const token = `@@RQ_MATH_${placeholders.length}@@`;
        placeholders.push(injectPreamble(math, preamble));
        output += token;
    };

    while (index < source.length) {
        const fence = matchFenceStart(source, index);
        if (fence) {
            const end = findFenceEnd(source, index, fence);
            output += source.slice(index, end);
            index = end;
            continue;
        }

        if (source[index] === '`') {
            const end = findInlineCodeEnd(source, index);
            output += source.slice(index, end);
            index = end;
            continue;
        }

        if (source.startsWith('$$', index)) {
            const close = findClosingDoubleDollar(source, index);
            if (close !== -1) {
                store(source.slice(index, close + 2));
                index = close + 2;
                continue;
            }
        }

        if (source.startsWith('\\(', index)) {
            const close = source.indexOf('\\)', index + 2);
            if (close !== -1) {
                store(source.slice(index, close + 2));
                index = close + 2;
                continue;
            }
        }

        if (source.startsWith('\\[', index)) {
            const close = source.indexOf('\\]', index + 2);
            if (close !== -1) {
                store(source.slice(index, close + 2));
                index = close + 2;
                continue;
            }
        }

        if (source[index] === '$' && canOpenInlineDollar(source, index)) {
            const next = findClosingInlineDollar(source, index);
            if (next !== -1) {
                store(source.slice(index, next + 1));
                index = next + 1;
                continue;
            }
        }

        if (source.startsWith('\\begin{', index)) {
            const envMatch = source.slice(index).match(/^\\begin\{([^}]+)\}/);
            if (envMatch && MATH_ENVIRONMENTS.includes(envMatch[1])) {
                const endToken = `\\end{${envMatch[1]}}`;
                const close = source.indexOf(endToken, index + envMatch[0].length);
                if (close !== -1) {
                    store(source.slice(index, close + endToken.length));
                    index = close + endToken.length;
                    continue;
                }
            }
        }

        output += source[index];
        index += 1;
    }

    return { output, placeholders };
}

function restoreMath(html, placeholders) {
    return placeholders.reduce(
        (currentHtml, math, index) => currentHtml.replaceAll(`@@RQ_MATH_${index}@@`, math),
        html
    );
}

function splitBlocks(source) {
    const blocks = [];
    const lines = source.replace(/\r\n?/g, '\n').split('\n');
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
        const inlineEndPattern = new RegExp(`^(.*?)\\\\end\\{${escapeRegExp(alias)}\\}\\s*(.*)$`, 'i');
        const nestedPattern = new RegExp(`^\\s*\\\\begin\\{${escapeRegExp(alias)}\\}\\b`, 'i');
        let depth = 1;
        const collected = [];

        const inlineEndMatch = startMatch[2].match(inlineEndPattern);
        if (inlineEndMatch) {
            flushBuffer();
            blocks.push({
                type: 'environment',
                env: ENVIRONMENT_MAP[alias].canonical,
                title: ENVIRONMENT_MAP[alias].title,
                counter: ENVIRONMENT_MAP[alias].counter,
                source: inlineEndMatch[1].trim()
            });
            if (inlineEndMatch[2]) {
                buffer.push(inlineEndMatch[2]);
            }
            continue;
        }

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
            env: ENVIRONMENT_MAP[alias].canonical,
            title: ENVIRONMENT_MAP[alias].title,
            counter: ENVIRONMENT_MAP[alias].counter,
            source: collected.join('\n').trim()
        });
        lineIndex = cursor;
    }

    flushBuffer();

    if (!blocks.length) {
        return [{ type: 'markdown', source }];
    }

    return blocks.filter((block) => block.type === 'environment' || block.source.trim());
}

function stripLabels(source) {
    const labels = [];
    const cleaned = source.replace(/\\label\{([^}]+)\}/g, (_, label) => {
        labels.push(label);
        return '';
    });
    return { cleaned, labels };
}

function renderMarkdown(source, preamble) {
    if (!source.trim()) {
        return '';
    }

    const { output, placeholders } = protectMath(source, preamble);
    const html = markdown.render(output);
    return restoreMath(html, placeholders);
}

function replaceReferenceTokens(source, references) {
    return source
        .replace(/\\eqref\{([^}]+)\}/g, (match, label) => {
            const reference = references.get(label);
            return reference
                ? `<a class="latex-ref" href="#${reference.anchorId}">(${reference.number})</a>`
                : match;
        })
        .replace(/\\ref\{([^}]+)\}/g, (match, label) => {
            const reference = references.get(label);
            return reference
                ? `<a class="latex-ref" href="#${reference.anchorId}">${reference.number}</a>`
                : match;
        });
}

function mathSpanEndAt(source, index) {
    if (source.startsWith('$$', index)) {
        const close = findClosingDoubleDollar(source, index);
        return close === -1 ? -1 : close + 2;
    }

    if (source.startsWith('\\(', index)) {
        const close = source.indexOf('\\)', index + 2);
        return close === -1 ? -1 : close + 2;
    }

    if (source.startsWith('\\[', index)) {
        const close = source.indexOf('\\]', index + 2);
        return close === -1 ? -1 : close + 2;
    }

    if (source[index] === '$' && canOpenInlineDollar(source, index)) {
        const close = findClosingInlineDollar(source, index);
        return close === -1 ? -1 : close + 1;
    }

    if (source.startsWith('\\begin{', index)) {
        const envMatch = source.slice(index).match(/^\\begin\{([^}]+)\}/);
        if (envMatch && MATH_ENVIRONMENTS.includes(envMatch[1])) {
            const endToken = `\\end{${envMatch[1]}}`;
            const close = source.indexOf(endToken, index + envMatch[0].length);
            return close === -1 ? -1 : close + endToken.length;
        }
    }

    return -1;
}

function replaceReferences(html, references) {
    let output = '';
    let plain = '';
    let index = 0;

    const flushPlain = () => {
        if (plain) {
            output += replaceReferenceTokens(plain, references);
            plain = '';
        }
    };

    while (index < html.length) {
        const mathEnd = mathSpanEndAt(html, index);
        if (mathEnd !== -1) {
            flushPlain();
            output += html.slice(index, mathEnd);
            index = mathEnd;
            continue;
        }

        plain += html[index];
        index += 1;
    }

    flushPlain();
    return output;
}

function renderEnvironment(block, state, preamble) {
    const { cleaned, labels } = stripLabels(block.source);
    let suffix = '';
    let anchorId = '';

    if (block.counter) {
        state.counters[block.counter] += 1;
        suffix = ` ${state.counters[block.counter]}`;
        anchorId = `${block.counter}-${state.counters[block.counter]}`;
        labels.forEach((label) => {
            state.references.set(label, {
                anchorId,
                number: state.counters[block.counter]
            });
        });
    }

    const body = renderMarkdown(cleaned, preamble);
    if (block.env === 'proof') {
        return `<section class="env-block env-proof"><span class="env-title">${block.title}.</span> ${body} <span class="proof-end">&#9633;</span></section>`;
    }

    return `<section id="${anchorId}" class="env-block env-${block.env}"><span class="env-title">${block.title}${suffix}.</span> ${body}</section>`;
}

export function renderDocument(source, options = {}) {
    const preamble = options.preamble || '';
    const blocks = splitBlocks(source || '');
    const state = {
        counters: { ...COUNTER_TEMPLATE },
        references: new Map()
    };

    const html = blocks.map((block) => {
        if (block.type === 'environment') {
            return renderEnvironment(block, state, preamble);
        }

        return renderMarkdown(block.source, preamble);
    }).join('');

    return {
        html: replaceReferences(html, state.references),
        references: state.references
    };
}

function normalizeExcerptSource(source) {
    const lines = String(source || '')
        .replace(/\r\n?/g, '\n')
        .replace(/\\begin\{(theorem|thm|lemma|lem|definition|defn|conjecture|conj|problem|proof)\}\s*/gi, '')
        .replace(/\s*\\end\{(theorem|thm|lemma|lem|definition|defn|conjecture|conj|problem|proof)\}/gi, '')
        .replace(/\\label\{[^}]+\}/g, '')
        .split('\n')
        .map((line) => line.replace(/^\s{0,3}#{1,6}\s+/, ''))
        .filter((line) => !/^\s{0,3}(=+|-+)\s*$/.test(line));

    return lines.join('\n').trim();
}

function estimateMathDisplayLength(source) {
    const text = String(source || '')
        .replace(/^(\$\$|\$|\\\(|\\\[)/, '')
        .replace(/(\$\$|\$|\\\)|\\\])$/, '')
        .replace(/\\begin\{[^}]+\}/g, ' ')
        .replace(/\\end\{[^}]+\}/g, ' ')
        .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?\{([^}]*)\}/g, '$1')
        .replace(/\\[a-zA-Z]+\*?/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return Math.min(Math.max(text.length || 12, 12), 48);
}

function buildMathAwareExcerptSource(source, length = 160) {
    const normalized = normalizeExcerptSource(source);
    if (!normalized) {
        return '';
    }

    const { output, placeholders } = protectMath(normalized, '');
    const compact = output.replace(/\s+/g, ' ').trim();
    if (!compact) {
        return placeholders[0] || '';
    }

    const tokenPattern = /@@RQ_MATH_(\d+)@@/g;
    let result = '';
    let visibleLength = 0;
    let lastIndex = 0;
    let truncated = false;

    const appendText = (text) => {
        if (!text || truncated) {
            return;
        }

        const remaining = length - visibleLength;
        if (remaining <= 0) {
            truncated = true;
            return;
        }

        if (text.length > remaining) {
            result += text.slice(0, remaining).trimEnd();
            visibleLength = length;
            truncated = true;
            return;
        }

        result += text;
        visibleLength += text.length;
    };

    let match;
    while ((match = tokenPattern.exec(compact))) {
        appendText(compact.slice(lastIndex, match.index));
        if (truncated) {
            break;
        }

        const token = match[0];
        const mathSource = placeholders[Number(match[1])] || '';
        const weight = estimateMathDisplayLength(mathSource);
        if (visibleLength + weight > length && result.trim()) {
            truncated = true;
            break;
        }

        result += token;
        visibleLength += Math.min(weight, length - visibleLength);
        lastIndex = tokenPattern.lastIndex;
    }

    if (!truncated) {
        appendText(compact.slice(lastIndex));
    }

    const restored = restoreMath(result.trim(), placeholders);
    if (!restored) {
        return placeholders[0] || '';
    }

    return truncated ? `${restored}...` : restored;
}

export function renderExcerpt(source, options = {}) {
    const excerptSource = buildMathAwareExcerptSource(source, options.length ?? 160);
    if (!excerptSource) {
        return {
            html: renderMarkdown(options.emptyText || 'No content yet.', ''),
            references: new Map()
        };
    }

    return renderDocument(excerptSource, options);
}

export function renderPreviewDocument(source, options = {}) {
    const text = String(source || '').trim();
    if (!text) {
        return renderExcerpt(options.emptyText || 'No content yet.', options);
    }

    const [firstBlock] = splitBlocks(text);
    if (!firstBlock || firstBlock.type !== 'environment') {
        return renderExcerpt(text, options);
    }

    const excerptSource = buildMathAwareExcerptSource(firstBlock.source, options.length ?? 260);
    if (!excerptSource) {
        return renderExcerpt(options.emptyText || 'No content yet.', options);
    }

    return renderDocument(
        `\\begin{${firstBlock.env}}\n${excerptSource}\n\\end{${firstBlock.env}}`,
        options
    );
}

export function renderInlineMath(source, options = {}) {
    const text = String(source || '')
        .replace(/\r\n?/g, '\n')
        .trim();

    if (!text) {
        return '';
    }

    const { output, placeholders } = protectMath(text, options.preamble || '');
    return restoreMath(
        escapeHtml(output).replace(/\s*\n+\s*/g, ' '),
        placeholders
    );
}

export function toPlainExcerpt(source, length = 160) {
    const text = (source || '')
        .replace(/\\begin\{[^}]+\}/g, ' ')
        .replace(/\\end\{[^}]+\}/g, ' ')
        .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
        .replace(/[`*_>#~-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!text) {
        return 'No content yet.';
    }

    return text.length > length ? `${text.slice(0, length).trim()}...` : text;
}

function clearMath(element) {
    if (!element || !window.MathJax?.typesetClear) {
        return;
    }

    try {
        window.MathJax.typesetClear([element]);
    } catch (error) {
        // Ignore cleanup errors when the container was never typeset.
    }
}

export function setRenderedHtml(element, rendered) {
    if (!element) {
        return;
    }

    clearMath(element);
    element.innerHTML = rendered.html || '';
}

async function waitForMathJax() {
    if (typeof window === 'undefined') {
        return null;
    }

    if (window.MathJax?.startup?.promise) {
        await window.MathJax.startup.promise;
        return window.MathJax?.typesetPromise ? window.MathJax : null;
    }

    if (window.MathJax?.typesetPromise) {
        return window.MathJax;
    }

    if (!mathJaxReadyPromise) {
        mathJaxReadyPromise = new Promise((resolve) => {
            const startedAt = Date.now();
            const script = document.getElementById('MathJax-script');

            const finish = async () => {
                try {
                    if (window.MathJax?.startup?.promise) {
                        await window.MathJax.startup.promise;
                        resolve(window.MathJax?.typesetPromise ? window.MathJax : null);
                        return;
                    }

                    resolve(window.MathJax?.typesetPromise ? window.MathJax : null);
                } catch (error) {
                    resolve(null);
                }
            };

            const poll = () => {
                if (window.MathJax?.startup?.promise || window.MathJax?.typesetPromise || Date.now() - startedAt > 10000) {
                    finish();
                    return;
                }
                window.setTimeout(poll, 25);
            };

            if (script) {
                script.addEventListener('load', finish, { once: true });
                script.addEventListener('error', () => resolve(null), { once: true });
            }
            poll();
        });
    }

    return mathJaxReadyPromise;
}

export async function typesetElement(element) {
    if (!element) {
        return;
    }

    mathQueue = mathQueue.then(async () => {
        if (!element.isConnected) {
            return;
        }

        const MathJax = await waitForMathJax();
        if (!MathJax?.typesetPromise || !element.isConnected) {
            return;
        }

        await MathJax.typesetPromise([element]);
    }).catch(() => undefined);
    return mathQueue;
}
