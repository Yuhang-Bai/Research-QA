import { basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { markdown } from '@codemirror/lang-markdown';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { languages } from '@codemirror/language-data';

export const LATEX_SNIPPETS = [
    { label: '\\begin{theorem}', type: 'keyword', apply: '\\begin{theorem}\n\\label{thm:}\n\n\\end{theorem}' },
    { label: '\\begin{lemma}', type: 'keyword', apply: '\\begin{lemma}\n\\label{lem:}\n\n\\end{lemma}' },
    { label: '\\begin{definition}', type: 'keyword', apply: '\\begin{definition}\n\\label{def:}\n\n\\end{definition}' },
    { label: '\\begin{conjecture}', type: 'keyword', apply: '\\begin{conjecture}\n\\label{conj:}\n\n\\end{conjecture}' },
    { label: '\\begin{problem}', type: 'keyword', apply: '\\begin{problem}\n\\label{prob:}\n\n\\end{problem}' },
    { label: '\\begin{proof}', type: 'keyword', apply: '\\begin{proof}\n\n\\end{proof}' },
    { label: '\\begin{align}', type: 'keyword', apply: '\\begin{align}\n\n\\end{align}' },
    { label: '\\frac', type: 'function', apply: '\\frac{}{}' },
    { label: '\\mathbb', type: 'function', apply: '\\mathbb{}' },
    { label: '\\mathcal', type: 'function', apply: '\\mathcal{}' },
    { label: '\\operatorname', type: 'function', apply: '\\operatorname{}' },
    { label: '\\label', type: 'keyword', apply: '\\label{}' },
    { label: '\\ref', type: 'keyword', apply: '\\ref{}' },
    { label: '\\eqref', type: 'keyword', apply: '\\eqref{}' }
];

const completionSource = (context) => {
    const word = context.matchBefore(/\\[\w-]*/);
    if (!word && !context.explicit) {
        return null;
    }

    return {
        from: word ? word.from : context.pos,
        options: LATEX_SNIPPETS
    };
};

const editorTheme = EditorView.theme({
    '&': {
        height: '100%',
        backgroundColor: 'transparent'
    },
    '.cm-scroller': {
        overflow: 'auto'
    },
    '.cm-gutters': {
        backgroundColor: 'rgba(255,255,255,0.44)',
        color: 'rgba(109,98,87,0.72)',
        borderRight: '1px solid rgba(109,98,87,0.12)'
    },
    '.cm-activeLine': {
        backgroundColor: 'rgba(15,118,110,0.08)'
    },
    '.cm-selectionBackground': {
        backgroundColor: 'rgba(15,118,110,0.16) !important'
    }
});

export function createMarkdownEditor({ host, initialValue = '', placeholderText = '', onChange }) {
    const state = EditorState.create({
        doc: initialValue,
        extensions: [
            basicSetup,
            history(),
            keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, ...closeBracketsKeymap, ...completionKeymap]),
            markdown({ codeLanguages: languages }),
            closeBrackets(),
            autocompletion({ override: [completionSource] }),
            highlightSelectionMatches(),
            placeholder(placeholderText),
            editorTheme,
            EditorView.lineWrapping,
            EditorView.updateListener.of((update) => {
                if (update.docChanged && onChange) {
                    onChange(update.state.doc.toString());
                }
            })
        ]
    });

    const view = new EditorView({
        state,
        parent: host
    });

    return {
        getValue() {
            return view.state.doc.toString();
        },
        setValue(nextValue) {
            const currentValue = view.state.doc.toString();
            if (currentValue === nextValue) {
                return;
            }

            view.dispatch({
                changes: {
                    from: 0,
                    to: currentValue.length,
                    insert: nextValue
                }
            });
        },
        focus() {
            view.focus();
        },
        destroy() {
            view.destroy();
        }
    };
}
