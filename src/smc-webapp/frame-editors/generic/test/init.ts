// import {init} from "./util";

// const w = window as any;
// (window as any).test_init = init;

const w = window as any;

w.test_load = {};

w.test_load.basic = function () {
  require("../../markdown-editor/test/basic");
};

w.test_load.math = function () {
  require("../../markdown-editor/test/math");
};
