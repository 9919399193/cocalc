/*
Manage a collection of terminals in the frame tree.
*/

import { Actions } from "../code-editor/actions";
import { AppRedux } from "../../app-framework";
import { connect_to_server } from "./connect-to-server";
import * as tree_ops from "../frame-tree/tree-ops";
import { len } from "../generic/misc";
import { Terminal } from "xterm";
import { setTheme } from "./themes";
import { open_init_file } from "./init-file";
import { endswith } from "../generic/misc";
import { delay } from "awaiting";

import "./connected-terminal";

const copypaste = require("smc-webapp/copy-paste-buffer");

interface Path {
  file?: string;
  directory?: string;
}

export class TerminalManager {
  protected terminals: { [key: string]: Terminal } = {};
  private actions: Actions;
  private redux: AppRedux;

  constructor(actions: Actions, redux: AppRedux) {
    this.actions = actions;
    this.redux = redux;
  }

  close(): void {
    for (let id in this.terminals) {
      this.close_terminal(id);
    }
  }

  async set_terminal(id: string, terminal: Terminal): Promise<void> {
    this.terminals[id] = terminal;
    this.init_settings(terminal);

    /* All this complicated code starting here is just to get
       a stable number for this frame. Sorry it is so complicated! */
    let node = this.actions._get_frame_node(id);
    if (node === undefined) {
      // to satisfy typescript
      return;
    }
    let number = node.get("number");

    const numbers = {};
    for (let id0 in this.actions._get_leaf_ids()) {
      const node0 = tree_ops.get_node(this.actions._get_tree(), id0);
      if (node0 == null || node0.get("type") != "terminal") {
        continue;
      }
      let n = node0.get("number");
      if (n !== undefined) {
        if (numbers[n] && n === number) {
          number = undefined;
        }
        numbers[n] = true;
      }
    }
    for (let i = 0; i < len(numbers); i++) {
      if (!numbers[i]) {
        number = i;
        break;
      }
    }
    if (number === undefined) {
      number = len(numbers);
    }
    // Set number entry of this node.
    this.actions.set_frame_tree({ id, number });

    // OK, above got the stable number.  Now connect:
    try {
      await connect_to_server(
        this.actions.project_id,
        this.actions.path,
        terminal,
        number
      );
    } catch (err) {
      this.actions.set_error(
        `Error connecting to server -- ${err} -- try closing and reopening or restarting project.`
      );
    }
    terminal.on("mesg", mesg => this.handle_mesg(id, mesg));
    terminal.on("title", title => {
      if (title != null) {
        this.actions.set_title(id, title);
      }
    });

    terminal.attachCustomKeyEventHandler(event => {
      //console.log("key", event);
      if ((terminal as any).is_paused) {
        this.actions.unpause(id);
      }

      if (event.type === "keypress") {
        // ignore this
        return true;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key === "<"
      ) {
        this.actions.decrease_font_size(id);
        return false;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key === ">"
      ) {
        this.actions.increase_font_size(id);
        return false;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "c" &&
        terminal.hasSelection()
      ) {
        // Return so that the usual OS copy happens
        // instead of interrupt signal.
        return false;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "v") {
        // Return so that the usual paste happens.
        return false;
      }

      return true;
    });

    // pause: sync local view state with terminal state
    if (node != null && node.get("is_paused")) {
      (terminal as any).pause();
    }
  }

  close_terminal(id: string): void {
    if (!this.terminals[id]) {
      // graceful no-op if no such terminal.
      return;
    }
    const conn = (this.terminals[id] as any).conn;
    this.terminals[id].destroy();
    delete this.terminals[id];
    if (conn != null) {
      conn.end();
    }
  }

  // TODO: maybe rename to has_terminal ?
  exists(id: string): boolean {
    return this.terminals[id] !== undefined;
  }

  focus(id?: string): void {
    if (id === undefined) {
      id = this.actions._get_most_recent_terminal_id();
      if (id === undefined) {
        return; // no terminals
      }
    }
    const t = this.terminals[id];
    if (t !== undefined) {
      t.focus();
    }
  }

  get_terminal(id: string): Terminal | undefined {
    return this.terminals[id];
  }

  handle_mesg(
    id: string,
    mesg: { cmd: string; rows?: number; cols?: number; payload: any }
  ): void {
    //console.log("handle_mesg", id, mesg);
    switch (mesg.cmd) {
      case "size":
        if (typeof mesg.rows === "number" && typeof mesg.cols === "number") {
          this.resize(id, mesg.rows, mesg.cols);
        }
        break;
      case "burst":
        this.burst_on(id);
        break;
      case "no-burst":
        this.burst_off(id);
        break;
      case "no-ignore":
        this.ignore_off(id);
        break;
      case "close":
        this.close_request(id);
        break;
      case "message":
        const payload = mesg.payload;
        if (payload == null) {
          break;
        }
        if (payload.event === "open") {
          if (payload.paths !== undefined) {
            this.open_paths(id, payload.paths);
          }
          break;
        }
        if (payload.event === "close") {
          if (payload.paths !== undefined) {
            this.close_paths(id, payload.paths);
          }
          break;
        }
        break;
      default:
        console.log("handle_mesg -- unhandled", id, mesg);
    }
  }

  burst_on(_: string): void {
    // TODO: would be better to make specific to that terminal... but not implemented.
    this.actions.set_status(
      "WARNING: Large burst of output! (May try to interrupt.)"
    );
    this.actions.set_error(
      "WARNING: Large burst of output! (May try to interrupt.)"
    );
  }

  burst_off(_: string): void {
    this.actions.set_status("");
    this.actions.set_error("");
  }

  async ignore_off(id: string): Promise<void> {
    const terminal = this.get_terminal(id);
    if (terminal === undefined) {
      return;
    }
    await delay(100);
    (terminal as any).ignore_terminal_data = false;
  }

  close_request(id: string): void {
    this.actions.set_error(
      "Another user closed one of your terminal sessions."
    );
    // If there is only one frame, we close the
    // entire editor -- otherwise, we close only
    // this frame.
    if (
      this.actions._tree_is_single_leaf() &&
      endswith(this.actions.path, ".term")
    ) {
      this._close_path(this.actions.path);
    } else {
      this.actions.close_frame(id);
    }
  }

  open_paths(id: string, paths: Path[]): void {
    const terminal = this.get_terminal(id);
    if (terminal === undefined) {
      return;
    }
    if (!(terminal as any).is_mounted) {
      return;
    }
    const project_actions = this.actions._get_project_actions();
    let i = 0;
    let foreground = false;
    for (let x of paths) {
      i += 1;
      if (i === paths.length) {
        foreground = true;
      }
      if (x.file != null) {
        const path = x.file;
        project_actions.open_file({ path, foreground });
      }
      if (x.directory != null && foreground) {
        project_actions.open_directory(x.directory);
      }
    }
  }

  _close_path(path: string): void {
    const project_actions = this.actions._get_project_actions();
    project_actions.close_tab(path);
  }

  close_paths(id: string, paths: Path[]): void {
    const terminal = this.get_terminal(id);
    if (terminal === undefined) {
      return;
    }
    if (!(terminal as any).is_mounted) {
      return;
    }
    for (let x of paths) {
      if (x.file != null) {
        this._close_path(x.file);
      }
    }
  }

  resize(id: string, rows: number, cols: number): void {
    const terminal: Terminal | undefined = this.get_terminal(id);
    if (terminal === undefined) {
      return;
    }
    if (terminal.cols === cols && terminal.rows === rows) {
      // no need to resize
      return;
    }
    terminal.resize(cols, rows);
  }

  init_settings(terminal: Terminal): void {
    const account = this.redux.getStore("account");
    if (account == null) {
      return;
    }
    const settings = account.get_terminal_settings();
    if (settings == null) {
      return;
    }

    if (settings.color_scheme !== undefined) {
      setTheme(terminal, settings.color_scheme);
    }

    terminal.setOption(
      "fontSize",
      settings.font_size ? settings.font_size : 14
    );

    // The following option possibly makes xterm.js better at
    // handling huge bursts of data by pausing the backend temporarily.
    terminal.setOption("useFlowControl", true);

    // Interesting to play with, but breaks copy.
    //terminal.setOption("rendererType", "dom");

    terminal.setOption("scrollback", 5000);

    if (settings.font) {
      terminal.setOption("fontFamily", settings.font);
    }
  }

  kick_other_users_out(id: string): void {
    const terminal = this.get_terminal(id);
    if (terminal === undefined) {
      return;
    }
    (terminal as any).conn_write({ cmd: "boot" });
  }

  pause(id: string): void {
    const terminal = this.get_terminal(id);
    if (terminal === undefined) {
      return;
    }
    (terminal as any).pause();
  }

  unpause(id: string): void {
    const terminal = this.get_terminal(id);
    if (terminal === undefined) {
      return;
    }
    (terminal as any).unpause();
  }

  reload(id: string): void {
    const terminal = this.get_terminal(id);
    if (terminal === undefined) {
      return;
    }
    (terminal as any).unpause();
  }

  async edit_init_script(id: string): Promise<void> {
    const terminal = this.get_terminal(id);
    if (terminal === undefined) {
      return;
    }
    try {
      await open_init_file(
        this.actions._get_project_actions(),
        (terminal as any).path
      );
    } catch (err) {
      this.actions.set_error(`Problem opening init file -- ${err}`);
    }
  }

  popout(id: string): void {
    const terminal = this.get_terminal(id);
    if (terminal === undefined) {
      return;
    }
    const path: string = (terminal as any).path;
    this.actions._get_project_actions().open_file({ path, foreground: true });
  }

  copy(id: string): void {
    const terminal = this.get_terminal(id);
    if (terminal === undefined) {
      return;
    }
    const sel: string = terminal.getSelection();
    copypaste.set_buffer(sel);
    terminal.focus();
  }

  paste(id: string): void {
    const terminal = this.get_terminal(id);
    if (terminal === undefined) {
      return;
    }
    terminal.clearSelection();
    (terminal as any)._core.handler(copypaste.get_buffer());
    terminal.focus();
  }
}
