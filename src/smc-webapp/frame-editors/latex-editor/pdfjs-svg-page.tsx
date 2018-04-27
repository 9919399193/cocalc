/* Render a single PDF page using SVG */

import * as $ from "jquery";

import { Component, React, ReactDOM } from "../react";

import { SVGGraphics, PDFPageProxy, PDFPageViewport } from "pdfjs-dist/webpack";

import { is_different } from "../misc";

import { AnnotationLayer } from "./pdfjs-annotation.tsx";

interface Props {
  page: PDFPageProxy;
  scale: number;
  click_annotation: Function;
}

export class SVGPage extends Component<Props, {}> {
  private mounted: boolean;

  shouldComponentUpdate(next_props: Props) {
    return (
      is_different(this.props, next_props, ["scale"]) ||
      this.props.page.version != next_props.page.version
    );
  }

  async render_page(page: PDFPageProxy, scale: number): Promise<void> {
    const div: HTMLElement = ReactDOM.findDOMNode(this.refs.page);
    const viewport: PDFPageViewport = page.getViewport(scale);
    div.style.width = viewport.width + "px";
    div.style.height = viewport.height + "px";
    try {
      const opList = await page.getOperatorList();
      if (!this.mounted) return;
      const svgGfx = new SVGGraphics(page.commonObjs, page.objs);
      const svg = await svgGfx.getSVG(opList, viewport);
      if (!this.mounted) return;
      $(div).empty();
      div.appendChild(svg);
    } catch (err) {
      console.error(`pdf.js -- Error rendering svg page: ${err}`);
    }
  }

  componentWillReceiveProps(next_props: Props): void {
    this.render_page(next_props.page, next_props.scale);
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  componentDidMount(): void {
    this.mounted = true;
    this.render_page(this.props.page, this.props.scale);
  }

  render() {
    return (
      <div
        style={{
          margin: "auto",
          background: "white",
          position: "relative",
          display: "inline-block"
        }}
      >
        <AnnotationLayer
          page={this.props.page}
          scale={this.props.scale}
          click_annotation={this.props.click_annotation}
        />
        <div ref="page" />
      </div>
    );
  }
}
