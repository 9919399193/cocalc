/*
React component that renders the ordered list of cells
*/

declare const $: any;

import { delay } from "awaiting";
import * as immutable from "immutable";
import { React, Component, Rendered } from "../app-framework";
import { Loading } from "../r_misc/loading";
import { Cell } from "./cell";
import { InsertCell } from "./insert-cell";

import { JupyterActions } from "./browser-actions";
import { NotebookFrameActions } from "../frame-editors/jupyter-editor/cell-notebook/actions";

import { NotebookMode, Scroll } from "./types";

const PADDING = 100;

interface CellListProps {
  actions?: JupyterActions; // if not defined, then everything read only
  frame_actions?: NotebookFrameActions;
  name?: string;
  cell_list: immutable.List<string>; // list of ids of cells in order
  cells: immutable.Map<string, any>;
  font_size: number;
  sel_ids?: immutable.Set<string>; // set of selected cells
  md_edit_ids?: immutable.Set<string>;
  cur_id?: string; // cell with the green cursor around it; i.e., the cursor cell
  mode: NotebookMode;
  hook_offset?: number;
  scroll?: Scroll;
  cm_options: immutable.Map<string, any>;
  project_id?: string;
  directory?: string;
  scrollTop?: number;
  complete?: immutable.Map<string, any>; // status of tab completion
  is_focused?: boolean;
  more_output?: immutable.Map<string, any>;
  cell_toolbar?: string;
  trust?: boolean;
}

export class CellList extends Component<CellListProps> {
  private cell_list_ref: HTMLElement;
  private is_mounted: boolean = true;

  public componentWillUnmount(): void {
    this.is_mounted = false;
    if (this.cell_list_ref != null && this.props.frame_actions != null) {
      this.props.frame_actions.set_scrollTop(this.cell_list_ref.scrollTop);
    }

    if (this.props.frame_actions != null) {
      // handle focus via an event handler on window.
      // We have to do this since, e.g., codemirror editors
      // involve spans that aren't even children, etc...
      $(window).unbind("click", this.window_click);
      this.props.frame_actions.disable_key_handler();
    }
  }

  private async restore_scroll(): Promise<void> {
    if (this.props.scrollTop == null) return;
    /* restore scroll state -- as rendering happens dynamically
       and asynchronously, and I have no idea how to know when
       we are done, we can't just do this once.  Instead, we
       keep resetting scrollTop a few times.
    */
    let scrollHeight: number = 0;
    for (let tm of [0, 250, 750, 1500, 2000]) {
      if (!this.is_mounted) return;
      const elt = this.cell_list_ref;
      if (elt != null && elt.scrollHeight !== scrollHeight) {
        // dynamically rendering actually changed something
        elt.scrollTop = this.props.scrollTop;
        scrollHeight = elt.scrollHeight;
      }
      await delay(tm);
    }
  }

  public componentDidMount(): void {
    this.restore_scroll();
    if (this.props.frame_actions != null) {
      // Enable keyboard handler if necessary
      if (this.props.is_focused) {
        this.props.frame_actions.enable_key_handler();
      }
      // Also since just mounted, set this to be focused.
      // When we have multiple editors on the same page, we will
      // have to set the focus at a higher level (in the project store?).
      this.props.frame_actions.focus(true);
      // setup a click handler so we can manage focus
      $(window).on("click", this.window_click);
    }

    if (this.props.frame_actions != null) {
      this.props.frame_actions.cell_list_div = $(this.cell_list_ref);
    }
  }

  private window_click = (event: any): void => {
    if (this.props.frame_actions == null) return;
    if ($(".in.modal").length) {
      // A bootstrap modal is currently opened, e.g., support page, etc.
      // so do not focus no matter what -- in fact, blur for sure.
      this.props.frame_actions.blur();
      return;
    }
    // if click in the cell list, focus the cell list; otherwise, blur it.
    const elt = $(this.cell_list_ref);
    // list no longer exists, nothing left to do
    // Maybe elt can be null? https://github.com/sagemathinc/cocalc/issues/3580
    if (elt == null) return;

    const offset = elt.offset();
    if (offset == null) {
      // offset can definitely be null -- https://github.com/sagemathinc/cocalc/issues/3580
      return;
    }

    const x = event.pageX - offset.left;
    const y = event.pageY - offset.top;
    const outerH = elt.outerHeight();
    const outerW = elt.outerWidth();
    if (outerW != null && outerH != null) {
      if (x >= 0 && y >= 0 && x <= outerW && y <= outerH) {
        this.props.frame_actions.focus();
      } else {
        this.props.frame_actions.blur();
      }
    }
  };

  public componentWillReceiveProps(nextProps): void {
    if (this.props.frame_actions == null) return;
    if (nextProps.is_focused !== this.props.is_focused) {
      // the focus state changed.
      if (nextProps.is_focused) {
        this.props.frame_actions.enable_key_handler();
      } else {
        this.props.frame_actions.disable_key_handler();
      }
    }
    if (nextProps.scroll != null) {
      this.scroll_cell_list(nextProps.scroll);
      this.props.frame_actions.scroll(); // reset scroll request state
    }
  }

  private scroll_cell_list = (scroll: Scroll): void => {
    const elt = $(this.cell_list_ref);
    if (elt == null) {
      return;
    }
    if (elt.length > 0) {
      let cur, top;
      if (typeof scroll === "number") {
        elt.scrollTop(elt.scrollTop() + scroll);
        return;
      }

      // supported scroll positions are in types.ts
      if (scroll === "cell visible") {
        if (!this.props.cur_id) return;
        // ensure selected cell is visible
        cur = elt.find(`#${this.props.cur_id}`);
        if (cur.length > 0) {
          top = cur.position().top - elt.position().top;
          if (top < PADDING) {
            scroll = "cell top";
          } else if (top > elt.height() - PADDING) {
            scroll = "cell bottom";
          } else {
            return;
          }
        }
      }
      switch (scroll) {
        case "list up":
          // move scroll position of list up one page
          return elt.scrollTop(elt.scrollTop() - elt.height() * 0.9);
        case "list down":
          // move scroll position of list up one page
          return elt.scrollTop(elt.scrollTop() + elt.height() * 0.9);
        case "cell top":
          cur = elt.find(`#${this.props.cur_id}`);
          if (cur != null && cur.length > 0) {
            return elt.scrollTop(
              elt.scrollTop() +
                (cur.position().top - elt.position().top) -
                PADDING
            );
          }
          break;
        case "cell center":
          cur = elt.find(`#${this.props.cur_id}`);
          if (cur != null && cur.length > 0) {
            return elt.scrollTop(
              elt.scrollTop() +
                (cur.position().top - elt.position().top) -
                elt.height() * 0.5
            );
          }
          break;
        case "cell bottom":
          cur = elt.find(`#${this.props.cur_id}`);
          if (cur.length > 0) {
            return elt.scrollTop(
              elt.scrollTop() +
                (cur.position().top - elt.position().top) -
                elt.height() * 0.9 +
                PADDING
            );
          }
          break;
      }
    }
  };

  private render_loading(): Rendered {
    return (
      <div
        style={{
          fontSize: "32pt",
          color: "#888",
          textAlign: "center",
          marginTop: "15px"
        }}
      >
        <Loading />
      </div>
    );
  }

  private on_click = e => {
    if (this.props.actions) this.props.actions.clear_complete();
    if ($(e.target).hasClass("cocalc-complete")) {
      // Bootstrap simulates a click even when user presses escape; can't catch there.
      // See the complete component in codemirror-static.
      if (this.props.frame_actions) this.props.frame_actions.set_mode("edit");
    }
  };

  private render_insert_cell(
    id: string,
    position: "above" | "below" = "above"
  ): Rendered {
    if (this.props.actions == null || this.props.frame_actions == null) return;
    return (
      <InsertCell
        id={id}
        key={id + "insert" + position}
        position={position}
        actions={this.props.actions}
        frame_actions={this.props.frame_actions}
      />
    );
  }

  public render(): Rendered {
    if (this.props.cell_list == null) {
      return this.render_loading();
    }

    const v: any[] = [];
    this.props.cell_list.forEach((id: string) => {
      const cell_data = this.props.cells.get(id);
      // is it possible/better idea to use the @actions.store here?
      const editable = cell_data.getIn(["metadata", "editable"], true);
      const deletable = cell_data.getIn(["metadata", "deletable"], true);
      const cell = (
        <Cell
          key={id}
          actions={this.props.actions}
          frame_actions={this.props.frame_actions}
          name={this.props.name}
          id={id}
          cm_options={this.props.cm_options}
          cell={cell_data}
          is_current={id === this.props.cur_id}
          hook_offset={this.props.hook_offset}
          is_selected={
            this.props.sel_ids != null
              ? this.props.sel_ids.contains(id)
              : undefined
          }
          is_markdown_edit={
            this.props.md_edit_ids != null
              ? this.props.md_edit_ids.contains(id)
              : undefined
          }
          mode={this.props.mode}
          font_size={this.props.font_size}
          project_id={this.props.project_id}
          directory={this.props.directory}
          complete={this.props.complete}
          is_focused={this.props.is_focused}
          more_output={
            this.props.more_output != null
              ? this.props.more_output.get(id)
              : undefined
          }
          cell_toolbar={this.props.cell_toolbar}
          trust={this.props.trust}
          editable={editable}
          deletable={deletable}
          nbgrader={cell_data.getIn(["metadata", "nbgrader"])}
        />
      );
      if (this.props.actions != null) {
        v.push(this.render_insert_cell(id));
      }
      v.push(cell);
    });
    if (this.props.actions != null && v.length > 0) {
      const id = this.props.cell_list.get(this.props.cell_list.size - 1);
      if (id != null) {
        v.push(this.render_insert_cell(id, "below"));
      }
    }

    const style: React.CSSProperties = {
      fontSize: `${this.props.font_size}px`,
      padding: "5px",
      height: "100%",
      overflowY: "auto",
      overflowX: "hidden"
    };

    const cells_style: React.CSSProperties = {
      backgroundColor: "#fff",
      padding: "15px",
      boxShadow: "0px 0px 12px 1px rgba(87, 87, 87, 0.2)"
    };

    return (
      <div
        key="cells"
        style={style}
        ref={(node: any) => (this.cell_list_ref = node)}
        onClick={
          this.props.actions != null && this.props.complete != null
            ? this.on_click
            : undefined
        }
      >
        <div style={cells_style}>{v}</div>
        <div style={{ minHeight: "100px" }} />
      </div>
    );
  }
}
