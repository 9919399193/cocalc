/*
Manages rendering a single page using either SVG or Canvas
*/

import { React, Rendered, Component } from "../react";

import { is_different } from "../misc";

import { NonloadedPage } from "./pdfjs-nonloaded-page.tsx";
import { SVGPage } from "./pdfjs-svg-page.tsx";
import { CanvasPage } from "./pdfjs-canvas-page.tsx";

import {
  PDFAnnotationData,
  PDFPageProxy,
  PDFDocumentProxy
} from "pdfjs-dist/webpack";

export const PAGE_GAP: number = 20;

interface PageProps {
  actions: any;
  id: string;
  n: number;
  doc: PDFDocumentProxy;
  renderer: string;
  scale: number;
  page: PDFPageProxy;
}

export class Page extends Component<PageProps, {}> {
  constructor(props) {
    super(props);
  }

  shouldComponentUpdate(next_props: PageProps): boolean {
    return (
      is_different(this.props, next_props, ["n", "renderer", "scale"]) ||
      this.props.doc.pdfInfo.fingerprint !== next_props.doc.pdfInfo.fingerprint
    );
  }

  render_content(): Rendered {
    if (!this.props.page) return;
    const f = annotation => {
      this.click_annotation(annotation);
    };
    if (this.props.renderer == "none") {
      return <NonloadedPage page={this.props.page} scale={this.props.scale} />;
    } else if (this.props.renderer == "svg") {
      return (
        <SVGPage
          page={this.props.page}
          scale={this.props.scale}
          click_annotation={f}
        />
      );
    } else {
      return (
        <CanvasPage
          page={this.props.page}
          scale={this.props.scale}
          click_annotation={f}
        />
      );
    }
  }

  render_page_number(): Rendered {
    return (
      <div
        style={{
          textAlign: "center",
          color: "white",
          height: `${PAGE_GAP}px`
        }}
      >
        Page {this.props.n}
      </div>
    );
  }

  click(event): void {
    let x: number = event.nativeEvent.offsetX / this.props.scale;
    let y: number = event.nativeEvent.offsetY / this.props.scale;
    this.props.actions.synctex_pdf_to_tex(this.props.n, x, y);
  }

  async click_annotation(annotation: PDFAnnotationData): Promise<void> {
    if (annotation.url) {
      // Link to an external URL.
      // TODO: make it work for cocalc URL's, e.g., cocalc.com...
      let win = window.open(annotation.url, "_blank");
      if (win) {
        win.focus();
      }
      return;
    }
    if (annotation.dest) {
      // Internal link within the document.
      let dest = await this.props.doc.getDestination(annotation.dest);
      let page: number = (await this.props.doc.getPageIndex(dest[0])) + 1;
      let page_height = this.props.page.pageInfo.view[3];
      this.props.actions.scroll_into_view(
        page,
        page_height - dest[3],
        this.props.id
      );
      return;
    }
    console.warn("Uknown annotation link", annotation);
  }

  render() {
    return (
      <div>
        {this.render_page_number()}
        <div
          style={{ background: "#525659" }}
          onDoubleClick={e => this.click(e)}
        >
          {this.render_content()}
        </div>
      </div>
    );
  }
}
