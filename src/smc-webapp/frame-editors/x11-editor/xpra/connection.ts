/*
CoCalc Xpra HTML Client

Websocket connection between browser and backend xpra server.
Runs in the same process as the main DOM (there is also a
webworker version, and this is not it).
*/
import { ReceiveQueue, SendQueue } from "./protocol";

function createWebsocket(uri: string, bus: any): WebSocket {
  const socket = new WebSocket(uri, "binary");

  socket.binaryType = "arraybuffer";
  socket.onopen = function(ev) {
    bus.emit("ws:open", ev);
  };
  socket.onclose = function(ev) {
    bus.emit("ws:close", ev);
  };
  socket.onerror = function(ev) {
    bus.emit("ws:error", ev);
  };
  socket.onmessage = function(ev) {
    const data = new Uint8Array(ev.data);
    bus.emit("ws:data", ev, data);
  };

  return socket;
}

export class Connection {
  private socket;
  private receiveQueue;
  private sendQueue;
  private bus;

  constructor(bus) {
    this.bus = bus;
    this.receiveQueue = new ReceiveQueue((...args) => {
      this.bus.emit(...args);
    });
    this.sendQueue = new SendQueue();

    this.bus.on("ws:data", (_, packet) => {
      this.receiveQueue.push(packet, this.socket);
    });

    this.send = this.send.bind(this);
  }

  send(...packet): void {
    if (packet.length <= 1) {  // TODO: check only need for debug dev mode.
      throw Error(
        `x11: send takes at least 2 arguments  -- ${JSON.stringify(packet)}`
      );
    }
    this.sendQueue.push(packet, this.socket);
  }

  flush(): void {
    this.sendQueue.clear();
    this.receiveQueue.clear();
  }

  open(config): void {
    this.socket = createWebsocket(config.uri, this.bus);
  }

  close(): void {
    if (this.socket) {
      this.socket.close();
    }
    this.socket = null;
  }
}
