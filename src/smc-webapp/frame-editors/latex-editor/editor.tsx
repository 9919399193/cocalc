/*
Top-level react component for editing LaTeX documents.
*/

import { React, rclass, rtypes, Component, Rendered } from "../react";

//import { FormatBar } from "../markdown-editor/format-bar";
const { FormatBar } = require("../markdown-editor/format-bar");

//import { Editor as BaseEditor, set } from "../code-editor/editor";
const editor = require("../code-editor/editor");
const BaseEditor = editor.Editor;
const set = editor.set;

import { PDFJS } from "./pdfjs.tsx";

import { PDFEmbed } from "./pdf-embed.tsx";

// import { LaTeXJS } from "./latexjs";
// import { PEG } from "./peg";

//import { CodemirrorEditor } from "../code-editor/codemirror-editor";
const { CodemirrorEditor } = require("../code-editor/codemirror-editor");

import { Build } from "./build.tsx";
import { ErrorsAndWarnings } from "./errors-and-warnings.tsx";

import { pdf_path } from "./util";

let pdfjs_buttons = set([
  "print",
  "save",
  "decrease_font_size",
  "increase_font_size",
  "zoom_page_width",
  "zoom_page_height",
  "sync"
]);

const EDITOR_SPEC = {
  cm: {
    short: "LaTeX",
    name: "LaTeX Source Code",
    icon: "code",
    component: CodemirrorEditor,
    buttons: set([
      "print",
      "decrease_font_size",
      "increase_font_size",
      "save",
      "time_travel",
      "replace",
      "find",
      "goto_line",
      "cut",
      "paste",
      "copy",
      "undo",
      "redo",
      "sync",
      "help"
    ]),
    gutters: ["Codemirror-latex-errors"]
  },

  pdfjs_canvas: {
    short: "PDF (canvas)",
    name: "PDF - Canvas",
    icon: "file-pdf-o",
    component: PDFJS,
    buttons: pdfjs_buttons,
    path: pdf_path,
    style: { background: "#525659" },
    renderer: "canvas"
  },

  error: {
    short: "Errors",
    name: "Errors and Warnings",
    icon: "bug",
    component: ErrorsAndWarnings,
    buttons: set([])
  },

  build: {
    short: "Build",
    name: "Build Control",
    icon: "terminal",
    component: Build,
    buttons: set([])
  },

  embed: {
    short: "PDF (native)",
    name: "PDF - Native",
    icon: "file-pdf-o",
    buttons: set(["print", "save"]),
    component: PDFEmbed,
    path: pdf_path
  },

  pdfjs_svg: {
    short: "PDF (svg)",
    name: "PDF - SVG",
    icon: "file-pdf-o",
    component: PDFJS,
    buttons: pdfjs_buttons,
    path: pdf_path,
    style: { background: "#525659" },
    renderer: "svg"
  }

  /*
    latexjs: {
        short: "Preview 1",
        name: "Rough Preview  1 - LaTeX.js",
        icon: "file-pdf-o",
        component: LaTeXJS,
        buttons: set([
            "print",
            "save",
            "decrease_font_size",
            "increase_font_size"
        ])
    },

    peg: {
        short: "Preview 2",
        name: "Rough Preview 2 - PEG.js",
        icon: "file-pdf-o",
        component: PEG,
        buttons: set([
            "print",
            "save",
            "decrease_font_size",
            "increase_font_size"
        ])
    } */
};

interface EditorProps {
  actions: any;
  path: string;
  project_id: string;

  // reduxProps:
  name: string;
  editor_settings: Map<string, any>;
  is_public: boolean;
}

class Editor extends Component<EditorProps, {}> {
  static reduxProps({ name }) {
    return {
      account: {
        editor_settings: rtypes.immutable.Map
      },
      [name]: {
        is_public: rtypes.bool
      }
    };
  }

  shouldComponentUpdate(next): boolean {
    if (!this.props.editor_settings) return false;
    return (
      this.props.editor_settings.get("extra_button_bar") !==
      next.editor_settings.get("extra_button_bar")
    );
  }

  render_format_bar(): Rendered {
    if (
      !this.props.is_public &&
      this.props.editor_settings &&
      this.props.editor_settings.get("extra_button_bar")
    )
      return <FormatBar actions={this.props.actions} extension={"tex"} />;
  }

  render_editor(): Rendered {
    return (
      <BaseEditor
        name={this.props.name}
        actions={this.props.actions}
        path={this.props.path}
        project_id={this.props.project_id}
        editor_spec={EDITOR_SPEC}
      />
    );
  }

  render() {
    return (
      <div className="smc-vfill">
        {this.render_format_bar()}
        {this.render_editor()}
      </div>
    );
  }
}

const tmp = rclass(Editor);
export { tmp as Editor };
