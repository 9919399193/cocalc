/*
Run BibTex
*/

import { exec } from "../async-utils";
import { parse_path } from "./util";

// time (ms since epoch) to use for aggregate

export async function bibtex(project_id: string, path: string, time?: number) {
  const { base, directory } = parse_path(path);
  return exec({
    allow_post: true,
    command: "bibtex",
    args: [base],
    project_id: project_id,
    path: directory,
    err_on_exit: false,
    aggregate: time
  });
}
