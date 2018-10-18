// Use Xpra to provide X11 server.

import { createClient } from "./xpra/client";

const DPI: number = 96;

const KEY_EVENTS = ["keydown", "keyup", "keypress"];

const MOUSE_EVENTS = [
  "mousemove",
  "mousedown",
  "mouseup",
  "wheel",
  "mousewheel",
  "DOMMouseScroll"
];

interface Options {
  project_id: string;
  path: string;
}

import { EventEmitter } from "events";

export class XpraClient extends EventEmitter {
  private options: Options;
  private xpra_options: any;
  private client: any;
  private windows: any = {};

  constructor(options: Options) {
    super();
    this.options = options;
    this.init();
  }

  async init(): Promise<void> {
    await this.init_client();
    this.init_xpra_events();
    this.connect();
  }

  close(): void {
    if (this.client === undefined) {
      return;
    }
    this.blur();
    this.client.disconnect();
    delete this.windows;
    delete this.options;
    delete this.xpra_options;
    delete this.client;
  }

  connect(): void {
    this.client.connect(this.xpra_options);
  }

  private async init_client(): Promise<void> {
    // TODO
    const port = 2000; // will determine this async via api call to backend that starts server.
    const uri = `wss://${window.location.hostname}${window.app_base_url}/${
      this.options.project_id
    }/server/${port}/`;
    const dpi = Math.round(DPI * window.devicePixelRatio);
    this.xpra_options = { uri, dpi, sound: false };
    this.client = createClient(this.xpra_options);
  }

  private init_xpra_events(): void {
    this.client.on("window:create", this.window_create.bind(this));
    this.client.on("window:destroy", this.window_destroy.bind(this));
    this.client.on("window:icon", this.window_icon.bind(this));
    this.client.on("window:metadata", this.window_metadata.bind(this));
    this.client.on("overlay:create", this.overlay_create.bind(this));
    this.client.on("overlay:destroy", this.overlay_destroy.bind(this));
    this.client.on("ws:status", this.ws_status.bind(this));
    //this.client.on("ws:data", this.ws_data.bind(this));  // ridiculously low level.
  }

  focus(): void {
    this.enable_window_events();
  }

  focus_window(wid: number): void {
    if (wid && this.windows[wid] !== undefined) {
      this.client.surface.focus(wid);
    }
  }

  close_window(wid: number): void {
    if (wid && this.windows[wid] !== undefined) {
      this.client.surface.kill(wid);
      delete this.windows[wid];
    }
  }

  blur(): void {
    this.disable_window_events();
  }

  private enable_window_events(): void {
    const doc = $(document);
    for (let name of KEY_EVENTS) {
      doc.on(name, this.client.key_inject);
    }
    for (let name of MOUSE_EVENTS) {
      doc.on(name, this.client.mouse_inject);
    }
  }

  private disable_window_events(): void {
    const doc = $(document);
    for (let name of KEY_EVENTS) {
      doc.off(name, this.client.key_inject);
    }
    for (let name of MOUSE_EVENTS) {
      doc.off(name, this.client.mouse_inject);
    }
  }

  render_window(wid: number, elt: HTMLElement): void {
    const info = this.windows[wid];
    if (info === undefined) {
      throw Error("no such window");
    }
    const canvas = $(info.canvas);
    const scale = window.devicePixelRatio;

    // margin:auto makes it centered.
    canvas
      .css("margin", "auto")
      .width(`${info.canvas.width / scale}px`)
      .height(`${info.canvas.height / scale}px`);
    //.css({ borderRight: "1px solid grey" })
    //.css({ borderBottom: "1px solid grey" });

    const e: JQuery<HTMLElement> = $(elt);
    e.empty();
    e.append(canvas);

    // Also append any already known overlays.
    for (let id in this.windows) {
      const w = this.windows[id];
      if (w.parent.wid === wid) {
        this.place_overlay_in_dom(w);
      }
    }
  }

  window_create(window): void {
    console.log("window_create", window);
    this.windows[window.wid] = window;
    this.emit("window:create", window.wid, {
      wid: window.wid,
      width: window.w,
      height: window.h,
      title: window.metadata.title
    });
  }

  // Any new top-level window gets moved to position 0,0 and
  // resized to fill the screen.
  resize_window(wid: number, width: number, height: number): void {
    const info = this.windows[wid];
    if (info === undefined) {
      console.warn("no window", wid);
      return; // no such window
    }

    const scale = window.devicePixelRatio;
    const surface = this.client.findSurface(wid);
    if (!surface) {
      // just removed?
      return;
    }
    let swidth = Math.round(width * scale);
    let sheight = Math.round(height * scale);

    // In some cases, we will only potentially SHRINK (so buttons can be seen!),
    // but not enlarge, which is usually really annoying.
    //const modal = info.metadata["modal"];
    if (
      info.metadata["window-type"] != null &&
      info.metadata["window-type"][0] === "DIALOG"
    ) {
      if (swidth >= info.w) {
        swidth = info.w;
      }
      if (sheight >= info.h) {
        sheight = info.h;
      }
    }

    // Honor any size constraints
    const size_constraints = info.metadata["size-constraints"];
    if (size_constraints != null) {
      const mn = size_constraints["minimum-size"],
        mx = size_constraints["maximum-size"];
      if (mn != null) {
        if (swidth < mn[0]) {
          swidth = mn[0];
        }
        if (sheight < mn[1]) {
          sheight = mn[1];
        }
      }
      if (mx != null) {
        if (swidth > mx[0]) {
          swidth = mx[0];
        }
        if (sheight > mx[1]) {
          sheight = mx[1];
        }
      }
    }
    if (swidth === info.w && sheight === info.h) {
      // make no change...
      return;
    }

    console.log("resize_window ", wid, width, height, swidth, sheight);
    surface.updateCSSGeometry(swidth, sheight);
    this.client.send(
      "configure-window",
      wid,
      0,
      0,
      swidth,
      sheight,
      info.properties
    );
  }

  window_destroy(window): void {
    console.log("window_destroy", window);
    delete this.windows[window.wid];
    this.emit("window:destroy", window.wid);
  }

  window_icon(icon): void {
    //console.log("window_icon", icon);
    this.emit("window:icon", icon.wid, icon.src);
  }

  window_metadata(info): void {
    console.log("window_metadata", info);
  }

  place_overlay_in_dom(overlay): void {
    const e = $(overlay.canvas);
    e.css("position", "absolute");
    const scale = window.devicePixelRatio;
    console.log(
      "setting overlay width to ",
      `${overlay.canvas.width / scale}px`
    );
    const width = `${overlay.canvas.width / scale}px`,
      height = `${overlay.canvas.height / scale}px`,
      left = `${overlay.x / scale}px`,
      top = `${overlay.y / scale}px`;
    e.css({ width, height, left, top });
    // if parent not in DOM yet, the following is no-op.
    $(overlay.parent.canvas)
      .parent()
      .append(e);
  }

  overlay_create(overlay): void {
    console.log("overlay_create", overlay);
    this.windows[overlay.wid] = overlay;
    this.place_overlay_in_dom(overlay);
  }

  overlay_destroy(overlay): void {
    console.log("overlay_destroy", overlay);
    delete this.windows[overlay.wid];
    $(overlay.canvas).remove();
  }

  ws_status(info): void {
    console.log("ws_status", info);
  }
  ws_data(_, packet): void {
    console.log("ws_data", packet);
  }
}
