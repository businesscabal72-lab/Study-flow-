"use client";
import { type Editor, useEditorState } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Table,
  Undo2,
  Rows3,
  Columns3,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

function Btn({ onClick, active, label, children, disabled }: { onClick: () => void; active?: boolean; label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep editor selection
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 [&_svg]:size-4",
        active && "bg-accent text-foreground"
      )}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px shrink-0 bg-border" />;

export function EditorToolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      table: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto px-1 py-1" role="toolbar" aria-label="Formatting">
      <Btn label="Undo" onClick={() => c().undo().run()} disabled={!s.canUndo}><Undo2 /></Btn>
      <Btn label="Redo" onClick={() => c().redo().run()} disabled={!s.canRedo}><Redo2 /></Btn>
      <Sep />
      <Btn label="Heading 1" active={s.h1} onClick={() => c().toggleHeading({ level: 1 }).run()}><Heading1 /></Btn>
      <Btn label="Heading 2" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 /></Btn>
      <Btn label="Heading 3" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 /></Btn>
      <Sep />
      <Btn label="Bold" active={s.bold} onClick={() => c().toggleBold().run()}><Bold /></Btn>
      <Btn label="Italic" active={s.italic} onClick={() => c().toggleItalic().run()}><Italic /></Btn>
      <Btn label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()}><Strikethrough /></Btn>
      <Btn label="Inline code" active={s.code} onClick={() => c().toggleCode().run()}><Code /></Btn>
      <Sep />
      <Btn label="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()}><List /></Btn>
      <Btn label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()}><ListOrdered /></Btn>
      <Btn label="Checklist" active={s.task} onClick={() => c().toggleTaskList().run()}><ListChecks /></Btn>
      <Btn label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()}><Quote /></Btn>
      <Btn label="Code block" active={s.codeBlock} onClick={() => c().toggleCodeBlock().run()}><SquareCode /></Btn>
      <Btn label="Divider" onClick={() => c().setHorizontalRule().run()}><Minus /></Btn>
      <Sep />
      {!s.table ? (
        <Btn label="Insert table" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table /></Btn>
      ) : (
        <>
          <Btn label="Add row" onClick={() => c().addRowAfter().run()}><Rows3 /></Btn>
          <Btn label="Add column" onClick={() => c().addColumnAfter().run()}><Columns3 /></Btn>
          <Btn label="Delete table" onClick={() => c().deleteTable().run()}><Trash2 /></Btn>
        </>
      )}
    </div>
  );
}
