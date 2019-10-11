/*
 * Landing actions are certain "intentions" for specific actions,
 * which are triggerd upon starting the webapp.
 * They guide a user through a sequence of steps, probably with some logic.
 *
 * Motivating example number 1: a URL pointing to /app encodes a custom software image,
 * which guides someone through signing in/up and then presents a dialog to
 * create a new project with that software environment,
 * or – in case there is already a project with that environment,
 * because the user comes back again via the same link –
 * presents that project to open up.
 *
 * A similar example is crating a new project with the files from a specific "share".
 * This means, there is a link on a share server page, which makes the file(s) runnable
 * with the least amount of friction.
 */

import { redux, Actions, Store } from "./app-framework";
import * as LS from "misc/local-storage";
import { analytics_event } from "./tracker";
import { QueryParams } from "./misc_page2";
import { uuid } from "smc-util/misc2";
import { retry_until_success, once } from "smc-util/async-utils";
import {
  custom_image_name,
  NAME as CUSTOM_SOFTWARE_NAME
} from "./custom-software/init";

export const NAME = "landing-actions";
const LS_KEY = NAME;

type LaunchTypes = "csi" | "share" | "binder" | undefined;

interface LaunchData {
  launch?: string;
  type?: LaunchTypes;
  filepath?: string;
  urlpath?: string;
}

class LandingActionsStore extends Store<LaunchData> {}

class LandingActions<LaunchData> extends Actions<LaunchData> {}

redux.createStore<LaunchData, LandingActionsStore>(NAME, LandingActionsStore, {});
const actions = redux.createActions(NAME, LandingActions);

function launch_share(launch: string): void {
  const share_id = launch.split("/")[1];
  console.log(`launching share with ID = ${share_id}`);
}

async function launch_custom_software_image(launch: string): Promise<void> {
  // processing e.g. "?launch=csi/opencv-machine-learning",
  // where the ID is a valid docker ID (lowercase, dashes)
  const image_id = launch.split("/")[1];
  // console.log(`launching custom software image with ID = ${image_id}`);

  const custom_software_table = await retry_until_success({
    f: async () => {
      let cst = redux.getTable(CUSTOM_SOFTWARE_NAME);
      if (cst == null)
        throw new Error("custom software table not yet available...");
      // what is this doing?
      await once(cst._table, "connected");
      return cst;
    }
  });

  if (!custom_software_table._table.value.has(image_id)) {
    console.error(
      `There is no custom software image with the ID "${image_id}"`
    );
    return;
  }

  // this is mimicing what's going on in projects/create-project.tsx
  const actions = await retry_until_success({
    f: async () => {
      let projects_table = redux.getTable("projects");
      if (projects_table == null)
        throw new Error("Projects Table not yet available...");
      // what is this doing?
      await once(projects_table._table, "connected");
      let actions = redux.getActions("projects");
      if (actions == null)
        throw new Error("Projects Actions not yet available...");
      return actions;
    }
  });

  const token = uuid();

  // TODO pick the proper title from the custom image table
  actions.create_project({
    title: image_id,
    image: custom_image_name(image_id),
    token
  });

  // if we have project actions, we can assume project store also exists?
  redux
    .getStore("projects")
    .wait_until_project_created(token, 30, (err, project_id) => {
      if (err != null) {
        console.error(`Error creating project -- ${err}`);
      } else {
        actions.apply_default_upgrades({ project_id });
        actions.open_project({ project_id, switch_to: true });
      }
    });

  analytics_event("create_project", "launch_csi");
}

function launch_binder(
  launch: string,
  filepath: string | undefined,
  urlpath: string | undefined
): void {
  // this decodes e.g. "?launch=binder/v2/gh/sagemathinc/cocalc/branch&filepath=start.ipynb"

  // config are the launch tokens, starting with v2
  const config: string[] = launch.split("/").slice(1);
  if (config[0] !== "v2") {
    // TODO show some error
    console.warn('Not a "v2" binder URL -- aborting');
    return;
  }

  switch (config[1]) {
    case "gh": // github, most common
      console.log(`binder github ${config.slice(2)}`);
      return;

    case "gist": // github gist, not sure how they look
      console.log(`binder gist ${config.slice(2)}`);
      return;

    case "gl": // gitlab
      console.log(`binder gitlab ${config.slice(2)}`);
      return;

    case "git": // pure git url, which types are supported?
      console.log(`binder git ${config.slice(2)}`);
      return;

    case "zenodo": // e.g. zenodo/10.5281/zenodo.3242074
      console.log(`binder zenodo ${config.slice(2)}`);
      return;

    default:
      console.warn(`Binder URL unknwn type' ${config[1]}' -- aborting`);
  }

  console.log(`filepath=${filepath}, urlpath=${urlpath}`);

  console.warn("STOP -- this is not yet implemented");
}

// persist any landing action information in local storage (e.g. it's lost via SSO)
export function store() {
  const params = QueryParams.get_all();
  // console.log("landing-actions: params =", params);
  const launch = params.launch;
  if (launch != null && typeof launch === "string") {
    const type = launch.split("/")[0] as LaunchTypes;
    const data: LaunchData = {
      launch,
      type
    };
    {
      const filepath = params.filepath;
      if (filepath != null && typeof filepath === "string") {
        data.filepath = filepath;
      }
    }
    {
      const urlpath = params.urlpath;
      if (urlpath != null && typeof urlpath === "string") {
        data.urlpath = urlpath;
      }
    }
    LS.set(LS_KEY, data);
    actions.setState(data);
  }
}

export function launch() {
  const data: LaunchData | undefined = LS.del<LaunchData>(LS_KEY);
  // console.log("landing-actions data=", data);
  if (data == null) return;
  const { type, launch } = data;
  if (launch != null && type != null && typeof launch === "string") {
    actions.setState(data);
    // the first token selects share server or custom software image
    switch (type) {
      case "binder":
        launch_binder(launch, data.filepath, data.urlpath);
        return;
      case "csi":
        launch_custom_software_image(launch);
        return;
      case "share":
        launch_share(launch);
        return;
      default:
        console.warn(`launch type "${type}" unknown`);
        return;
    }
  }
}
