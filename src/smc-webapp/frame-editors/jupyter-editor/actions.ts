/*
Jupyter Frame Editor Actions
*/

import { delay } from "awaiting";
import { FrameTree } from "../frame-tree/types";
import { Actions, CodeEditorState } from "../code-editor/actions";

import {
  create_jupyter_actions,
  close_jupyter_actions
} from "./jupyter-actions";

interface JupyterEditorState extends CodeEditorState {}

import { JupyterActions } from "../../jupyter/browser-actions";

import { NotebookFrameActions } from "./cell-notebook/actions";

export class JupyterEditorActions extends Actions<JupyterEditorState> {
  protected doctype: string = "none"; // actual document is managed elsewhere
  public jupyter_actions: JupyterActions;
  private frame_actions: { [id: string]: NotebookFrameActions } = {};

  _raw_default_frame_tree(): FrameTree {
    return { type: "jupyter_cell_notebook" };
  }

  _init2(): void {
    this.create_jupyter_actions();
    this.init_new_frame();
    this.init_changes_state();
  }

  public close(): void {
    this.close_jupyter_actions();
    super.close();
  }

  private init_new_frame(): void {
    this.store.on("new-frame", ({ id, type }) => {
      if (type !== "jupyter_cell_notebook") {
        return;
      }
      // important to do this *before* the frame is rendered,
      // since it can cause changes during creation.
      this.get_frame_actions(id);
    });

    for (let id in this._get_leaf_ids()) {
      const node = this._get_frame_node(id);
      if (node == null) return;
      const type = node.get("type");
      if (type === "jupyter_cell_notebook") {
        this.get_frame_actions(id);
      }
    }
  }

  private init_changes_state(): void {
    const syncdb = this.jupyter_actions.syncdb;
    syncdb.on("has-uncommitted-changes", has_uncommitted_changes =>
      this.setState({ has_uncommitted_changes })
    );
    syncdb.on("has-unsaved-changes", has_unsaved_changes => {
      this.setState({ has_unsaved_changes });
    });
  }

  async close_frame_hook(id: string, type: string): Promise<void> {
    if (type != "jupyter_cell_notebook") return;
    // TODO: need to free up frame actions when frame is destroyed.
    if (this.frame_actions[id] != null) {
      await delay(1);
      this.frame_actions[id].close();
      delete this.frame_actions[id];
    }
  }

  public focus(id?: string): void {
    const actions = this.get_frame_actions(id);
    if (actions != null) {
      actions.focus();
    } else {
      super.focus(id);
    }
  }

  public refresh(id: string): void {
    const actions = this.get_frame_actions(id);
    if (actions != null) {
      actions.refresh();
    } else {
      super.refresh(id);
    }
  }

  private create_jupyter_actions(): void {
    this.jupyter_actions = create_jupyter_actions(
      this.redux,
      this.name,
      this.path,
      this.project_id
    );
  }

  private close_jupyter_actions(): void {
    close_jupyter_actions(this.redux, this.name);
  }

  private get_frame_actions(id?: string): NotebookFrameActions | undefined {
    if (id === undefined) {
      id = this._get_active_id();
      if (id == null) throw Error("no active frame");
    }
    if (this.frame_actions[id] != null) {
      return this.frame_actions[id];
    }
    const node = this._get_frame_node(id);
    if (node == null) {
      throw Error(`no frame ${id}`);
    }
    const type = node.get("type");
    if (type === "jupyter_cell_notebook") {
      return (this.frame_actions[id] = new NotebookFrameActions(this, id));
    } else {
      return;
    }
  }

  // per-session sync-aware undo
  undo(id: string): void {
    id = id; // not used yet, since only one thing that can be undone.
    this.jupyter_actions.undo();
  }

  // per-session sync-aware redo
  redo(id: string): void {
    id = id; // not used yet
    this.jupyter_actions.redo();
  }

  cut(id: string): void {
    const actions = this.get_frame_actions(id);
    actions != null ? actions.cut() : super.cut(id);
  }

  copy(id: string): void {
    const actions = this.get_frame_actions(id);
    actions != null ? actions.copy() : super.copy(id);
  }

  paste(id: string, value?: string | true): void {
    const actions = this.get_frame_actions(id);
    actions != null ? actions.paste(value) : super.paste(id, value);
  }

  print(id): void {
    console.log("TODO: print", id);
    this.jupyter_actions.show_nbconvert_dialog("html");
  }

  async format(id: string): Promise<void> {
    const actions = this.get_frame_actions(id);
    actions != null ? await actions.format() : await super.format(id);
  }

  async save(explicit: boolean = true): Promise<void> {
    explicit = explicit; // not used yet -- might be used for "strip trailing whitespace"

    // Copy state from live codemirror editor into syncdb
    // since otherwise it won't be saved to disk.
    const id = this._active_id();
    const a = this.get_frame_actions(id);
    if (a != null && a.save_input_editor != null) {
      a.save_input_editor();
    }

    if (!this.jupyter_actions.syncdb.has_unsaved_changes()) return;

    // Do the save itself, using try/finally to ensure proper
    // setting of is_saving.
    try {
      this.setState({ is_saving: true });
      await this.jupyter_actions.save();
    } catch (err) {
      console.warn("save_to_disk", this.path, "ERROR", err);
      if (this._state == "closed") return;
      this.set_error(`error saving file to disk -- ${err}`);
    } finally {
      this.setState({ is_saving: false });
    }
  }

  protected async get_shell_spec(
    id: string
  ): Promise<undefined | { command: string; args: string[] }> {
    id = id; // not used
    // TODO: need to find out the file that corresponds to
    // socket and put in args.  Can find with ps on the pid.
    // Also, need to deal with it changing, and shells are
    // becoming invalid...
    return { command: "jupyter", args: ["console", "--existing"] };
  }

  // Not an action, but works to make code clean
  has_format_support(id: string, available_features?): false | string {
    id = id;
    const ext = this.jupyter_actions.store.get_kernel_ext();
    const markdown_only = "Format selected markdown cells using prettier.";
    if (ext == null) return markdown_only;
    if (available_features == null) return markdown_only;
    const tool = this.format_support_for_extension(available_features, ext);
    if (!tool) return markdown_only;
    return `Format selected code cells using "${tool}", stopping on first error; formats markdown using prettier.`;
  }
}
