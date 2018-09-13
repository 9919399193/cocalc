/*
Use Prettier to reformat the syncstring.

This very nicely use the in-memory node module to prettyify code, by simply modifying the syncstring
on the backend.  This avoids having to send the whole file back and forth, worrying about multiple users
and their cursors, file state etc.  -- it just merges in the prettification at a point in time.
Also, by doing this on the backend we don't add 5MB (!) to the webpack frontend bundle, to install
something that is not supported on the frontend anyway.

---

NOTE: for tex files, we use latexformat, rather than prettier.
*/

declare var require: any;

const { math_escape, math_unescape } = require("../smc-util/markdown-utils");
const prettier = require("prettier");
const { latex_format } = require("./latex-format");
const { python_format } = require("./python-format");
const { html_format } = require("./html-format");
const { r_format } = require("./r-format");
const { clang_format } = require("./clang-format");
const { gofmt } = require("./gofmt");
const misc = require("../smc-util/misc");
const body_parser = require("body-parser");
const express = require("express");
const { remove_math, replace_math } = require("../smc-util/mathjax-utils"); // from project Jupyter

import { callback } from "awaiting";

export async function run_prettier(
  client: any,
  path: string,
  options: any,
  logger: any
): Promise<object> {
  // What we do is edit the syncstring with the given path to be "prettier" if possible...
  let syncstring = client.sync_string({ path, reference_only: true });
  let doc;
  if (syncstring == null || (doc = syncstring.get_doc()) == null) {
    /* file not opened yet -- nothing to do. */
    return { status: "ok", phase: "loading" };
  }

  let pretty, math;
  let input = doc.to_str();
  if (options.parser === "markdown") {
    [input, math] = remove_math(math_escape(input));
  }
  try {
    pretty = await run_prettier_string(path, input, options, logger);
  } catch (err) {
    logger.debug(`run_prettier error: ${err.message}`);
    return { status: "error", phase: "format", error: err.message };
  }
  if (options.parser === "markdown") {
    pretty = math_unescape(replace_math(pretty, math));
  }
  syncstring.from_str(pretty);
  await callback(syncstring._save);
  return { status: "ok" };
}

export async function run_prettier_string(
  path: string | undefined,
  str: string,
  options: any,
  logger: any
): Promise<string> {
  let pretty;
  logger.debug(`run_prettier options.parser: "${options.parser}"`);
  switch (options.parser) {
    case "latex":
      pretty = await latex_format(str, options);
      break;
    case "python":
      pretty = await python_format(str, options, logger);
      break;
    case "r":
      pretty = await r_format(str, options, logger);
      break;
    case "html-tidy":
      pretty = await html_format(str, options);
      break;
    case "clang-format":
      const ext = misc.filename_extension(path !== undefined ? path : "");
      pretty = await clang_format(str, options, ext, logger);
      break;
    case "gofmt":
      pretty = await gofmt(str, options, logger);
      break;
    default:
      pretty = prettier.format(str, options);
  }
  return pretty;
}
