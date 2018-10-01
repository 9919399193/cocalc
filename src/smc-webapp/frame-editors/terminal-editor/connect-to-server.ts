/*
Connect the term.js terminal object to the backend terminal session with the given path.
*/

import { debounce } from "underscore";

import { delay } from "awaiting";

import { aux_file } from "../frame-tree/util";
import { project_websocket } from "../generic/client";

const MAX_HISTORY_LENGTH = 100 * 5000;

export async function connect_to_server(
  project_id: string,
  path: string,
  terminal: any,
  number: number
): Promise<void> {
  path = aux_file(`${path}-${number}`, "term");
  terminal.is_paused = false;
  terminal.path = path;

  let conn; // connection to project -- the primus channel.

  terminal.ignore_terminal_data = true;

  async function handle_data_from_project(data) {
    if (typeof data === "string") {
      if (terminal.is_paused && !terminal.ignore_terminal_data) {
        render_buffer += data;
      } else {
        render(data);
      }
    } else if (typeof data === "object") {
      terminal.emit("mesg", data);
    }
  }

  let render_buffer: string = "";
  let history: string = "";
  function render(data: string): void {
    history += data;
    if (history.length > MAX_HISTORY_LENGTH) {
      history = history.slice(
        history.length - Math.round(MAX_HISTORY_LENGTH / 1.5)
      );
    }
    terminal.write(data);
  }

  /* To test this full_rerender, do this in a terminal then start resizing it:
         printf "\E[c\n" ; sleep 1 ; echo
  */
  const full_rerender = debounce(async () => {
    terminal.ignore_terminal_data = true;
    terminal.reset();
    // This is a horrible hack, since we have to be sure the
    // reset (and its side effects) are really done before writing
    // the history again -- otherwise, the scroll is messed up.
    // The call to requestAnimationFrame is also done in xterm.js.
    // This really sucks.  It would probably be far better to just
    // REPLACE the terminal by a new one on resize!
    await delay(0);
    requestAnimationFrame(async () => {
      await delay(1);
      terminal.write(history);
      // NEED to make sure no device attribute requests are going out (= corruption!)
      // TODO: surely there is a better way.
      await delay(150);
      terminal.scrollToBottom(); // just in case.
      terminal.ignore_terminal_data = false;
    });
  }, 250);

  let last_size_rows, last_size_cols;
  terminal.on("resize", function() {
    if (terminal.cols === last_size_cols && terminal.rows === last_size_rows) {
      // no need to re-render
      return;
    }
    last_size_rows = terminal.rows;
    last_size_cols = terminal.cols;
    full_rerender();
  });

  terminal.pause = function(): void {
    terminal.is_paused = true;
  };

  terminal.unpause = function(): void {
    terminal.is_paused = false;
    render(render_buffer);
    render_buffer = "";
  };

  terminal.on("data", function(data) {
    if (terminal.ignore_terminal_data) {
      return;
    }
    terminal.conn_write(data);
  });

  terminal.conn_write = function(data) {
    if (conn === undefined) {
      // currently re-connecting.
      console.warn("ignoring write due to not conn", data);
      return;
    }
    conn.write(data);
  };

  async function reconnect_to_project() {
    //console.log("reconnect_to_project");
    let is_reconnect : boolean = false;
    if(conn !== undefined) {
      is_reconnect = true;
      conn.removeAllListeners();
    }
    const ws = await project_websocket(project_id);
    conn = await ws.api.terminal(path);
    conn.on("close", reconnect_to_project);  // remove close; not when we end.
    terminal.ignore_terminal_data = true;
    conn.on("data", handle_data_from_project);
    if (is_reconnect) {
      terminal.emit("reconnect");
    }
  }

  terminal.reconnect_to_project = reconnect_to_project;
  await reconnect_to_project();
}
