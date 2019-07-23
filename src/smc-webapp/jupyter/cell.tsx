/*
React component that describes a single cell
*/

import { React, Component, Rendered } from "../app-framework";
import { Map } from "immutable";

const misc_page = require("../misc_page"); // TODO: import type

import { COLORS } from "smc-util/theme";
import { INPUT_PROMPT_COLOR } from "./prompt";
import { Icon } from "../r_misc/icon";
import { Tip } from "../r_misc/tip";
import { CellInput } from "./cell-input";
import { CellOutput } from "./cell-output";

import { JupyterActions } from "./browser-actions";
import { NotebookFrameActions } from "../frame-editors/jupyter-editor/cell-notebook/actions";

import { NBGraderMetadata } from "./nbgrader/cell-metadata";

import { merge } from "smc-util/misc2";

interface CellProps {
  actions?: JupyterActions;
  frame_actions?: NotebookFrameActions;
  name?: string;
  id: string;
  cm_options: Map<string, any>;
  cell: Map<string, any>; // TODO: types
  is_current?: boolean;
  is_selected?: boolean;
  is_markdown_edit?: boolean;
  mode: "edit" | "escape";
  font_size: number;
  project_id?: string;
  directory?: string;
  complete?: Map<string, any>; // TODO: types
  is_focused?: boolean;
  more_output?: Map<string, any>; // TODO: types
  cell_toolbar?: string;
  trust?: boolean;
  editable?: boolean;
  deletable?: boolean;
  nbgrader?: Map<string, any>;
  hook_offset?: number;
}

export class Cell extends Component<CellProps> {
  public shouldComponentUpdate(nextProps: CellProps): boolean {
    // note: we assume project_id and directory don't change
    return !!(
      nextProps.id !== this.props.id ||
      nextProps.cm_options !== this.props.cm_options ||
      nextProps.cell !== this.props.cell ||
      nextProps.is_current !== this.props.is_current ||
      nextProps.is_selected !== this.props.is_selected ||
      nextProps.is_markdown_edit !== this.props.is_markdown_edit ||
      nextProps.mode !== this.props.mode ||
      nextProps.font_size !== this.props.font_size ||
      nextProps.is_focused !== this.props.is_focused ||
      nextProps.more_output !== this.props.more_output ||
      nextProps.cell_toolbar !== this.props.cell_toolbar ||
      nextProps.trust !== this.props.trust ||
      nextProps.editable !== this.props.editable ||
      nextProps.deletable !== this.props.deletable ||
      nextProps.nbgrader !== this.props.nbgrader ||
      (nextProps.complete !== this.props.complete &&
        (nextProps.is_current || this.props.is_current))
    );
  } // only worry about complete when editing this cell

  private render_cell_input(cell: Map<string, any>): Rendered {
    return (
      <CellInput
        key="in"
        cell={cell}
        actions={this.props.actions}
        frame_actions={this.props.frame_actions}
        cm_options={this.props.cm_options}
        is_markdown_edit={!!this.props.is_markdown_edit}
        is_focused={!!(this.props.is_current && this.props.mode === "edit")}
        is_current={!!this.props.is_current}
        id={this.props.id}
        font_size={this.props.font_size}
        project_id={this.props.project_id}
        directory={this.props.directory}
        complete={this.props.is_current ? this.props.complete : undefined}
        cell_toolbar={this.props.cell_toolbar}
        trust={this.props.trust}
        is_readonly={!this.props.editable}
      />
    );
  }

  private render_cell_output(cell: Map<string, any>): Rendered {
    return (
      <CellOutput
        key="out"
        cell={cell}
        actions={this.props.actions}
        frame_actions={this.props.frame_actions}
        name={this.props.name}
        id={this.props.id}
        project_id={this.props.project_id}
        directory={this.props.directory}
        more_output={this.props.more_output}
        trust={this.props.trust}
      />
    );
  }

  private click_on_cell = (event: any): void => {
    if (this.props.frame_actions == null) {
      return;
    }
    if (event.shiftKey && !this.props.is_current) {
      misc_page.clear_selection();
      this.props.frame_actions.select_cell_range(this.props.id);
      return;
    }
    this.props.frame_actions.set_cur_id(this.props.id);
    this.props.frame_actions.unselect_all_cells();
  };

  private render_hook(): Rendered {
    if (this.props.is_current && this.props.frame_actions != null) {
      return (
        <Hook
          hook_offset={this.props.hook_offset}
          mode={this.props.mode}
          frame_id={this.props.frame_actions.frame_id}
        />
      );
    }
  }

  private double_click = (event: any): void => {
    if (this.props.frame_actions == null) {
      return;
    }
    if (this.props.cell.getIn(["metadata", "editable"]) === false) {
      return;
    }
    if (this.props.cell.get("cell_type") !== "markdown") {
      return;
    }
    this.props.frame_actions.unselect_all_cells();
    const id = this.props.cell.get("id");
    this.props.frame_actions.set_md_cell_editing(id);
    this.props.frame_actions.set_cur_id(id);
    this.props.frame_actions.set_mode("edit");
    event.stopPropagation();
  };

  private render_deletable(): Rendered {
    if (this.props.deletable) return;
    return (
      <Tip
        title={"Protected from deletion"}
        placement={"right"}
        size={"small"}
        style={{ marginRight: "5px" }}
      >
        <Icon name="ban" />
      </Tip>
    );
  }

  private render_editable(): Rendered {
    if (this.props.editable) return;
    return (
      <Tip
        title={"Protected from modifications"}
        placement={"right"}
        size={"small"}
        style={{ marginRight: "5px" }}
      >
        <Icon name="lock" />
      </Tip>
    );
  }

  private render_nbgrader(): Rendered {
    if (this.props.nbgrader == null) return;
    return (
      <span>
        <Icon name="graduation-cap" style={{ marginRight: "5px" }} />
        <NBGraderMetadata
          nbgrader={this.props.nbgrader}
          start={this.props.cell.get("start")}
          state={this.props.cell.get("state")}
          output={this.props.cell.get("output")}
        />
      </span>
    );
  }

  private render_metadata_state(): Rendered {
    let style: React.CSSProperties;

    // note -- that second part is because the official
    // nbgrader demo has tons of cells with all the metadata
    // empty... which *cocalc* would not produce, but
    // evidently official tools do.
    const no_nbgrader: boolean =
      this.props.nbgrader == null ||
      (!this.props.nbgrader.get("grade") &&
        !this.props.nbgrader.get("solution") &&
        !this.props.nbgrader.get("locked"));
    if (no_nbgrader) {
      // Will not need more than two tiny icons.
      // If we add more metadata state indicators
      // that may take a lot of space, check for them
      // in the condition above.
      style = {
        position: "absolute",
        top: "2px",
        left: "5px",
        whiteSpace: "nowrap",
        color: COLORS.GRAY_L
      };
    } else {
      // Need arbitrarily much horizontal space, so we
      // get our own line.
      style = { color: COLORS.GRAY_L, marginBottom: "5px" };
    }

    if (this.props.is_current || this.props.is_selected) {
      // style.color = COLORS.BS_RED;
      style.color = INPUT_PROMPT_COLOR; // should be the same as the prompt; it's not an error.
    }

    return (
      <div style={style}>
        {this.render_deletable()}
        {this.render_editable()}
        {no_nbgrader ? undefined : this.render_nbgrader()}
      </div>
    );
  }

  public render(): Rendered {
    let color1: string, color2: string;
    if (this.props.is_current) {
      // is the current cell
      if (this.props.mode === "edit") {
        // edit mode
        color1 = color2 = "#66bb6a";
      } else {
        // escape mode
        if (this.props.is_focused) {
          color1 = "#ababab";
          color2 = "#42a5f5";
        } else {
          color1 = "#eee";
          color2 = "#42a5ff";
        }
      }
    } else {
      if (this.props.is_selected) {
        color1 = color2 = "#e3f2fd";
      } else {
        color1 = color2 = "white";
      }
    }
    const style: React.CSSProperties = {
      border: `1px solid ${color1}`,
      borderLeft: `5px solid ${color2}`,
      padding: "2px 5px",
      position: "relative"
    };

    if (this.props.is_selected) {
      style.background = "#e3f2fd";
    }

    // Note that the cell id is used for the cell-list.cjsx scroll functionality.
    return (
      <div
        style={style}
        onMouseUp={this.props.is_current ? undefined : this.click_on_cell}
        onDoubleClick={this.double_click}
        id={this.props.id}
        cocalc-test={"jupyter-cell"}
      >
        {this.render_hook()}
        {this.render_metadata_state()}
        {this.render_cell_input(this.props.cell)}
        {this.render_cell_output(this.props.cell)}
      </div>
    );
  }
}
/*
VISIBLE_STYLE =
    position   : 'absolute'
    color      : '#ccc'
    fontSize   : '6pt'
    paddingTop : '5px'
    right      : '-10px'
    zIndex     : 10
*/

const NOT_VISIBLE_STYLE: React.CSSProperties = {
  position: "absolute",
  fontSize: 0,
  zIndex: -100,
  left: 0,
  top: 0
};

interface Props {
  frame_id: string;
  hook_offset?: number;
  mode?: string;
}

class Hook extends Component<Props> {
  public render(): Rendered {
    let style;
    if (this.props.mode === "edit") {
      style = merge({ top: this.props.hook_offset }, NOT_VISIBLE_STYLE);
    } else {
      style = NOT_VISIBLE_STYLE;
    }
    return (
      <div
        style={style}
        className={`cocalc-jupyter-hook-${this.props.frame_id}`}
      >
        &nbsp;
      </div>
    );
  }
}
