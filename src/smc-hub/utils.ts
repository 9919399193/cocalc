/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

import * as fs from "fs";
const winston = require("./winston-metrics").get_logger("utils");
import { PostgreSQL } from "./postgres/types";
import { AllSiteSettings } from "../smc-util/db-schema/types";
import { expire_time } from "smc-util/misc";

export function get_smc_root(): string {
  return process.env.SMC_ROOT ?? ".";
}

export function read_db_password_from_disk(): string | null {
  const filename = get_smc_root() + "/data/secrets/postgres";
  try {
    return fs.readFileSync(filename).toString().trim();
  } catch {
    winston.debug("NO PASSWORD FILE!");
    return null;
  }
}

// just to make this async friendly, that's all
export async function get_server_settings(
  db: PostgreSQL
): Promise<AllSiteSettings> {
  return new Promise((done, fail) => {
    db.get_server_settings_cached({
      cb: (err, settings) => {
        if (err) {
          fail(err);
        } else {
          done(settings);
        }
      },
    });
  });
}

// use this to get the "expire" value for storing certain entries in the DB,
// which contain personally identifiable information.
// if data is set, it's expire field will be set. in any case, it returns the "Date"
// in the future.
export async function pii_expire<T extends object>(
  db: PostgreSQL,
  data?: T & { expire?: Date }
): Promise<Date | undefined> {
  const settings = await get_server_settings(db);
  const secs: number | false = settings.pii_retention;
  if (!secs) return;
  const future: Date = expire_time(secs);
  if (data != null) {
    data.expire = future;
  }
  return future;
}
