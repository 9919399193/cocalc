/*
Convert R Markdown file to hidden Markdown file, then read.
*/

import { aux_file } from "../frame-tree/util";
import { path_split } from "../generic/misc";
import { exec, read_text_file_from_project } from "../generic/client";

export async function convert(
  project_id: string,
  path: string,
  time?: number
): Promise<string> {
  const x = path_split(path);
  let infile = x.tail,
    outfile = aux_file(x.tail, "md");

  const args = [
    "-e",
    `library(knitr);knit('${infile}','${outfile}',quiet=TRUE)`
  ];

  await exec({
    allow_post: false, // definitely could take a long time to fully run all the R stuff...
    timeout: 60,
    command: "Rscript",
    args,
    project_id: project_id,
    path: x.head,
    err_on_exit: true,
    aggregate: time
  });

  return await read_text_file_from_project({
    project_id: project_id,
    path: aux_file(path, "md")
  });
}
