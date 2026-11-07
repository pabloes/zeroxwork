import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { useTranslation } from "../../i18n";
import { imageFromDataTransfer, uploadImage, UploadError } from "../../services/upload-image";
import ImagePicker from "./ImagePicker";

interface Props {
    value: string;
    onChange: (markdown: string) => void;
}

// tiptap-markdown ships no serializer for the image node, so anything written
// after an image gets glued to it ("![a](x.png)## Title"). This one closes the block.
const MarkdownImage = Image.extend({
    addStorage() {
        return {
            markdown: {
                serialize(state: any, node: any) {
                    const alt = state.esc(node.attrs.alt || '');
                    const src = node.attrs.src || '';
                    const title = node.attrs.title ? ` "${state.esc(node.attrs.title)}"` : '';
                    state.write(`![${alt}](${src}${title})`);
                    state.closeBlock(node);
                },
                parse: {},
            },
        };
    },
});

// tiptap-markdown adds this at runtime but does not type it for tiptap v3
type MarkdownStorage = { markdown: { getMarkdown: () => string } };

const getMarkdown = (editor: Editor) =>
    (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown();

// float-* end up as the image title, which the article stylesheet reads
const IMAGE_LAYOUTS = [
    { key: 'default', title: null, label: 'editor.image_wide' },
    { key: 'left', title: 'float-left', label: 'editor.image_left' },
    { key: 'right', title: 'float-right', label: 'editor.image_right' },
] as const;

const ToolbarButton: React.FC<{
    onClick: () => void;
    active?: boolean;
    label: string;
    children: React.ReactNode;
}> = ({ onClick, active, label, children }) => (
    <button
        type="button"
        className={`zx-tb-btn${active ? ' is-active' : ''}`}
        onClick={onClick}
        title={label}
        aria-label={label}
        aria-pressed={active}
    >
        {children}
    </button>
);

interface ToolbarProps {
    editor: Editor;
    t: (key: string) => string;
    uploading: number;
    onPickFile: () => void;
    onOpenLibrary: () => void;
    onToggleLink: () => void;
}

/** The buttons themselves. Rendered twice: on top, and in the floating bar. */
const Toolbar: React.FC<ToolbarProps> = ({ editor, t, uploading, onPickFile, onOpenLibrary, onToggleLink }) => (
    <div className="zx-editor-tools" role="toolbar" aria-label={t('editor.toolbar')}>
        <ToolbarButton label={t('editor.bold')} active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></ToolbarButton>
        <ToolbarButton label={t('editor.italic')} active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></ToolbarButton>

        <span className="zx-tb-sep" />

        <ToolbarButton label={t('editor.heading2')} active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
        <ToolbarButton label={t('editor.heading3')} active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarButton>

        <span className="zx-tb-sep" />

        <ToolbarButton label={t('editor.bullet_list')} active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}>•</ToolbarButton>
        <ToolbarButton label={t('editor.ordered_list')} active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</ToolbarButton>
        <ToolbarButton label={t('editor.quote')} active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</ToolbarButton>
        <ToolbarButton label={t('editor.code')} active={editor.isActive('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}>&lt;/&gt;</ToolbarButton>

        <span className="zx-tb-sep" />

        <ToolbarButton label={t('editor.link')} active={editor.isActive('link')}
            onClick={onToggleLink}>🔗</ToolbarButton>
        <ToolbarButton label={t('editor.image_from_device')}
            onClick={onPickFile}>🖼</ToolbarButton>
        <button type="button" className="zx-tb-text" onClick={onOpenLibrary}>
            {t('editor.image_from_library')}
        </button>

        {uploading > 0 && <span className="zx-tb-status">{t('editor.uploading')}</span>}
    </div>
);

/** Layout controls for the selected image. Also shown in both bars. */
const ImageBar: React.FC<{ editor: Editor; t: (key: string) => string }> = ({ editor, t }) => {
    const current = editor.getAttributes('image').title ?? null;

    return (
        <div className="zx-editor-subbar">
            <span>{t('editor.image_layout')}</span>
            {IMAGE_LAYOUTS.map(layout => (
                <button
                    key={layout.key}
                    type="button"
                    className={`zx-tb-text${current === layout.title ? ' is-active' : ''}`}
                    onClick={() => {
                        const attrs = editor.getAttributes('image');
                        editor.chain().focus().updateAttributes('image', { ...attrs, title: layout.title }).run();
                    }}
                >
                    {t(layout.label)}
                </button>
            ))}
        </div>
    );
};

const ArticleEditor: React.FC<Props> = ({ value, onChange }) => {
    const { t } = useTranslation();
    const [pickerOpen, setPickerOpen] = useState(false);
    const [uploading, setUploading] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const topBarRef = useRef<HTMLDivElement>(null);
    // the top bar has scrolled away while we are still inside the editor
    const [floating, setFloating] = useState(false);
    // what the parent last received from us, to tell our own edits from outside ones
    const emitted = useRef(value);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ link: false }),
            Link.configure({ openOnClick: false }),
            MarkdownImage.configure({ inline: false }),
            Placeholder.configure({ placeholder: t('editor.placeholder') }),
            Markdown.configure({ html: false, linkify: false, transformPastedText: true }),
        ],
        content: value,
        onUpdate: ({ editor }) => {
            const markdown = getMarkdown(editor);
            emitted.current = markdown;
            onChange(markdown);
        },
    });

    // Hydrate when the article arrives from the API (edit page). emitUpdate
    // defaults to true in tiptap v3, which would hand the parent a re-serialized
    // body before the author touches anything: the saved markdown would change
    // (and DeepL would retranslate) just for opening an old article.
    useEffect(() => {
        if (!editor || value === emitted.current) return;
        emitted.current = value;
        editor.commands.setContent(value, { emitUpdate: false });
    }, [editor, value]);

    const insertImage = useCallback((url: string) => {
        editor?.chain().focus().setImage({ src: url }).run();
    }, [editor]);

    const handleFiles = useCallback(async (files: File[]) => {
        if (files.length === 0) return;
        setError(null);
        setUploading(n => n + files.length);

        for (const file of files) {
            try {
                const uploaded = await uploadImage(file);
                insertImage(uploaded.url);
            } catch (e) {
                setError(t(`editor.error.${e instanceof UploadError ? e.message : 'failed'}`));
            } finally {
                setUploading(n => n - 1);
            }
        }
    }, [insertImage, t]);

    // drag & drop and paste, straight into the document
    useEffect(() => {
        if (!editor) return;

        const dom = editor.view.dom;
        const onDrop = (event: DragEvent) => {
            const files = imageFromDataTransfer(event.dataTransfer?.items ?? null);
            if (files.length === 0) return;
            event.preventDefault();
            handleFiles(files);
        };
        const onPaste = (event: ClipboardEvent) => {
            const files = imageFromDataTransfer(event.clipboardData?.items ?? null);
            if (files.length === 0) return;
            event.preventDefault();
            handleFiles(files);
        };
        const onDragOver = (event: DragEvent) => {
            if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
        };

        dom.addEventListener('drop', onDrop);
        dom.addEventListener('paste', onPaste);
        dom.addEventListener('dragover', onDragOver);
        return () => {
            dom.removeEventListener('drop', onDrop);
            dom.removeEventListener('paste', onPaste);
            dom.removeEventListener('dragover', onDragOver);
        };
    }, [editor, handleFiles]);

    // On a long article the top toolbar scrolls off. Mirror it at the bottom of
    // the window while the author is still inside the editor: once the end of
    // the editor rises past the strip the bar occupies, it goes away instead of
    // covering whatever comes next (the embed field, the submit button).
    useEffect(() => {
        if (!editor) return;

        const BAR = 84;
        let frame = 0;

        const measure = () => {
            frame = 0;
            const top = topBarRef.current;
            const root = rootRef.current;
            if (!top || !root) return;

            const topGone = top.getBoundingClientRect().bottom <= 0;
            const end = root.getBoundingClientRect().bottom;
            setFloating(topGone && end > window.innerHeight - BAR);
        };

        const onScroll = () => {
            if (frame === 0) frame = requestAnimationFrame(measure);
        };

        measure();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);

        // typing makes the editor taller without scrolling the page
        const sizes = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onScroll) : null;
        if (sizes && rootRef.current) sizes.observe(rootRef.current);

        return () => {
            if (frame) cancelAnimationFrame(frame);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            sizes?.disconnect();
        };
    }, [editor]);

    if (!editor) return null;

    const imageSelected = editor.isActive('image');

    const toggleLink = () => {
        if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run();
            return;
        }
        const url = window.prompt(t('editor.link_prompt'), 'https://');
        if (url) editor.chain().focus().setLink({ href: url }).run();
    };

    const toolbar = (
        <Toolbar
            editor={editor}
            t={t}
            uploading={uploading}
            onPickFile={() => fileInput.current?.click()}
            onOpenLibrary={() => setPickerOpen(true)}
            onToggleLink={toggleLink}
        />
    );

    return (
        <>
        <div className="zx-editor" ref={rootRef}>
            <div className="zx-editor-toolbar" ref={topBarRef}>{toolbar}</div>

            {imageSelected && <ImageBar editor={editor} t={t} />}

            <EditorContent editor={editor} className="zx-editor-surface markdown-body" />

            <p className="zx-editor-hint">{t('editor.drop_hint')}</p>
            {error && <p className="zx-form-error">{error}</p>}

            <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    handleFiles(files);
                }}
            />
        </div>

        {/* Same bar pinned to the bottom of the window once the top one is gone.
            Outside .zx-editor so its overflow and stacking cannot touch it. */}
        {floating && !pickerOpen && (
            <div className="zx-editor-float">
                <div className="zx-editor-float-inner">
                    {imageSelected && <ImageBar editor={editor} t={t} />}
                    {toolbar}
                </div>
            </div>
        )}

        {pickerOpen && (
            <ImagePicker
                onClose={() => setPickerOpen(false)}
                onSelect={(url) => {
                    insertImage(url);
                    setPickerOpen(false);
                }}
            />
        )}
        </>
    );
};

export type { Editor };
export default ArticleEditor;
