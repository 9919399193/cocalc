import { JupyterActions } from "../../../jupyter/browser-actions";
import {
  JupyterStore,
  initial_jupyter_store_state
} from "../../../jupyter/store";
import { syncdb2 as new_syncdb } from "../../generic/client";
const { webapp_client } = require("../../../webapp_client");
import { meta_file } from "smc-util/misc";
const { alert_message } = require("../../../alerts");

export function create_jupyter_actions(
  name: string,
  redux,
  path: string,
  project_id: string
): JupyterActions {
  name = "jupyter-" + name;
  const actions = redux.createActions(name, JupyterActions);
  const store = redux.createStore(
    name,
    JupyterStore,
    initial_jupyter_store_state
  );
  path = meta_file(path, "jupyter2"); // a.ipynb --> ".a.ipynb.sage-jupyter2"

  const syncdb = new_syncdb({
    project_id,
    path,
    change_throttle: 50, // our UI/React can handle more rapid updates; plus we want output FAST.
    patch_interval: 50,
    primary_keys: ["type", "id"],
    string_cols: ["input"],
    cursors: true,
    persistent: true
  });

  actions._init(project_id, path, syncdb, store, webapp_client);

  syncdb.once("init", err => {
    if (err) {
      const message = `Error opening '${path}' -- ${err}`;
      console.warn(message);
      alert_message({ type: "error", message });
      return;
    }
    if (syncdb.count() === 0) {
      actions._syncdb_change([]); // hack?  Needed?
    }
  });

  return actions;
}

export function close_jupyter_actions(
  redux,
  jupyter_actions: JupyterActions
): void {
  const name = jupyter_actions.name;
  const store = jupyter_actions.store;
  jupyter_actions.close();

  // cleanup assistant -- TODO: will eventually move to its own editor actions...
  // TODO: or maybe this should move to jupyter_actions.close()...
  if ((jupyter_actions as any).assistant_actions != null) {
    const assistant_name = (jupyter_actions as any).assistant_actions.name;
    delete redux.getStore(assistant_name).state;
    redux.removeStore(assistant_name);
    redux.removeActions(assistant_name);
  }

  // cleanup main store/actions
  delete store.state;
  redux.removeStore(name);
  redux.removeActions(name);
}
