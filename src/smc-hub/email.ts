//##############################################################################
//
//    CoCalc: Collaborative Calculation in the Cloud
//
//    Copyright (C) 2016 -- 2019, Sagemath Inc.
//
//    This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
//##############################################################################

//########################################
// Sending emails
//########################################

const BANNED_DOMAINS = { "qq.com": true };

const fs = require("fs");
const os_path = require("path");
const async = require("async");
const winston = require("./winston-metrics").get_logger("email");

// sendgrid API: https://sendgrid.com/docs/API_Reference/Web_API/mail.html
const sendgrid = require("sendgrid");

const misc = require("smc-util/misc");
const { defaults, required } = misc;

import * as sanitizeHtml from "sanitize-html";
import { contains_url } from "smc-util-node/misc2_node";

const {
  SENDGRID_TEMPLATE_ID,
  SENDGRID_ASM_NEWSLETTER,
  COMPANY_NAME,
  COMPANY_EMAIL,
  DOMAIN_NAME,
  SITE_NAME,
  DNS,
  HELP_EMAIL,
  LIVE_DEMO_REQUEST
} = require("smc-util/theme");

export function escape_email_body(body: string, allow_urls: boolean): string {
  // in particular, no img and no anchor a
  const allowedTags: string[] = [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "p",
    "ul",
    "ol",
    "nl",
    "li",
    "b",
    "i",
    "strong",
    "em",
    "strike",
    "code",
    "hr",
    "br",
    "div",
    "table",
    "thead",
    "caption",
    "tbody",
    "tr",
    "th",
    "td",
    "pre"
  ];
  if (allow_urls) {
    allowedTags.push("a");
  }
  return sanitizeHtml(body, { allowedTags });
}

// constructs the email body, also containing sign up instructions pointing to a project.
// it might throw an error!
function create_email_body(
  subject,
  body,
  email_address,
  project_title,
  link2proj,
  allow_urls_in_emails
): string {
  const base_url_tokens = link2proj.split("/");
  const base_url = `${base_url_tokens[0]}//${base_url_tokens[2]}`;
  const direct_link = `Open <a href='${link2proj}'>the project '${project_title}'</a>.`;

  let email_body = "";
  if (body) {
    email_body = escape_email_body(body, allow_urls_in_emails);
    // we check if there are plain URLs, which can be used to send SPAM
    if (!allow_urls_in_emails && contains_url(email_body)) {
      throw new Error("Sorry, links to specific websites are not allowed!");
    }
  } else {
    email_body = subject;
  }

  email_body += `
<br/><br/>
<b>To accept the invitation:
<ol>
<li>Open <a href="${base_url}/app">CoCalc</a></li>
<li>Sign up/in using <i>exactly</i> your email address <code>${email_address}</code></li>
<li>${direct_link}</li>
</ol></b>
<br/><br />
(If you're already signed in via <i>another</i> email address,
 you have to sign out and sign up/in using the mentioned email address.)
`;

  return email_body;
}

exports.create_email_body = create_email_body;

let email_server: any | undefined = undefined;

const is_banned = (exports.is_banned = function(address): boolean {
  const i = address.indexOf("@");
  if (i === -1) {
    return false;
  }
  const x = address.slice(i + 1).toLowerCase();
  return !!BANNED_DOMAINS[x];
});

// here's how I test this function:
//    require('email').send_email(subject:'TEST MESSAGE', body:'body', to:'wstein@sagemath.com', cb:console.log)
exports.send_email = function(opts): void {
  let dbg;
  if (opts == null) {
    opts = {};
  }
  opts = defaults(opts, {
    subject: required,
    body: required,
    fromname: COMPANY_NAME,
    from: COMPANY_EMAIL,
    to: required,
    replyto: undefined,
    replyto_name: undefined,
    cc: "",
    bcc: "",
    verbose: true,
    cb: undefined,
    category: undefined,
    asm_group: undefined
  });

  if (opts.verbose) {
    dbg = m => winston.debug(`send_email(to:${opts.to}) -- ${m}`);
  } else {
    dbg = function(_) {};
  }
  dbg(`${opts.body.slice(0, 201)}...`);

  if (is_banned(opts.to) || is_banned(opts.from)) {
    dbg("WARNING: attempt to send banned email");
    if (typeof opts.cb === "function") {
      opts.cb("banned domain");
    }
    return;
  }

  let disabled = false;
  return async.series(
    [
      function(cb): void {
        if (email_server != null) {
          cb();
          return;
        }
        dbg("starting sendgrid client...");
        const filename = `${process.env.SALVUS_ROOT}/data/secrets/sendgrid`;
        fs.readFile(filename, "utf8", function(error, api_key) {
          if (error) {
            const err = `unable to read the file '${filename}', which is needed to send emails.`;
            dbg(err);
            cb(err);
          } else {
            api_key = api_key.toString().trim();
            if (api_key.length === 0) {
              dbg(
                "email_server: explicitly disabled -- so pretend to always succeed for testing purposes"
              );
              disabled = true;
              email_server = { disabled: true };
              cb();
            } else {
              email_server = sendgrid(api_key);
              dbg("started sendgrid client");
              cb();
            }
          }
        });
      },
      function(cb): void {
        if (disabled || (email_server != null ? email_server.disabled : true)) {
          cb(undefined, "sendgrid email disabled -- no actual message sent");
          return;
        }
        dbg(`sending email to ${opts.to} starting...`);
        // Sendgrid V3 API -- https://sendgrid.com/docs/API_Reference/Web_API_v3/Mail/index.html
        const helper = sendgrid.mail;
        const from_email = new helper.Email(opts.from, opts.fromname);
        const to_email = new helper.Email(opts.to);
        const content = new helper.Content("text/html", opts.body);
        const mail = new helper.Mail(
          from_email,
          opts.subject,
          to_email,
          content
        );
        if (opts.replyto) {
          const replyto_name =
            opts.replyto_name != null ? opts.replyto_name : opts.replyto;
          mail.setReplyTo(new helper.Email(opts.replyto, replyto_name));
        }

        const personalization = new helper.Personalization();
        personalization.setSubject(opts.subject);
        personalization.addTo(to_email);
        if ((opts.cc != null ? opts.cc.length : undefined) > 0) {
          personalization.addCc(new helper.Email(opts.cc));
        }
        if ((opts.bcc != null ? opts.bcc.length : undefined) > 0) {
          personalization.addBcc(new helper.Email(opts.bcc));
        }

        // one or more strings to categorize the sent emails on sendgrid
        if (opts.category != null) {
          mail.addCategory(new helper.Category(opts.category));
        }

        // to unsubscribe only from a specific type of email, not everything!
        // https://app.sendgrid.com/suppressions/advanced_suppression_manager
        if (opts.asm_group != null) {
          mail.setAsm(new helper.Asm(opts.asm_group));
        }

        // plain template with a header (cocalc logo), a h1 title, and a footer
        mail.setTemplateId(SENDGRID_TEMPLATE_ID);
        // This #title# will end up below the header in an <h1> according to the template
        personalization.addSubstitution(
          new helper.Substitution("#title#", opts.subject)
        );

        mail.addPersonalization(personalization);

        // dbg("sending email to #{opts.to} data -- #{misc.to_json(mail.toJSON())}")

        // Sendgrid V3 API
        const request = email_server.emptyRequest({
          method: "POST",
          path: "/v3/mail/send",
          body: mail.toJSON()
        });

        email_server.API(request, function(err, res) {
          dbg(
            `sending email to ${opts.to} done...; got err=${misc.to_json(
              err
            )} and res=${misc.to_json(res)}`
          );
          if (err) {
            dbg(`sending email -- error = ${misc.to_json(err)}`);
          } else {
            dbg(`sending email -- success = ${misc.to_json(res)}`);
          }
          cb(err);
        });
      }
    ],
    function(err, message) {
      if (err) {
        // so next time it will try fresh to connect to email server, rather than being wrecked forever.
        email_server = undefined;
        err = `error sending email -- ${misc.to_json(err)}`;
        dbg(err);
      } else {
        dbg("successfully sent email");
      }
      typeof opts.cb === "function" ? opts.cb(err, message) : undefined;
    }
  );
};

// Send a mass email to every address in a file.
// E.g., put the email addresses in a file named 'a' and
//    require('email').mass_email(subject:'TEST MESSAGE', body:'body', to:'a', cb:console.log)
exports.mass_email = function(opts): void {
  opts = defaults(opts, {
    subject: required,
    body: required,
    from: COMPANY_EMAIL,
    fromname: COMPANY_NAME,
    to: required, // array or string (if string, opens and reads from file, splitting on whitspace)
    cc: "",
    limit: 10, // number to send in parallel
    cb: undefined
  }); // cb(err, list of recipients that we succeeded in sending email to)

  const dbg = m => winston.debug(`mass_email: ${m}`);
  dbg(opts.filename);
  dbg(opts.subject);
  dbg(opts.body);
  const success: string[] = [];
  const recipients: string[] = [];

  return async.series(
    [
      function(cb): void {
        if (typeof opts.to !== "string") {
          recipients.push(opts.to);
          cb();
        } else {
          fs.readFile(opts.to, function(err, data): void {
            if (err) {
              cb(err);
            } else {
              recipients.push(...misc.split(data.toString()));
              cb();
            }
          });
        }
      },
      function(cb): void {
        let n = 0;
        const f = function(to, cb) {
          if (n % 100 === 0) {
            dbg(`${n}/${recipients.length - 1}`);
          }
          n += 1;
          exports.send_email({
            subject: opts.subject,
            body: opts.body,
            from: opts.from,
            fromname: opts.fromname,
            to,
            cc: opts.cc,
            asm_group: SENDGRID_ASM_NEWSLETTER,
            category: "newsletter",
            verbose: false,
            cb(err): void {
              if (!err) {
                success.push(to);
                cb();
              } else {
                cb(`error sending email to ${to} -- ${err}`);
              }
            }
          });
        };

        async.mapLimit(recipients, opts.limit, f, cb);
      }
    ],
    err => (typeof opts.cb === "function" ? opts.cb(err, success) : undefined)
  );
};

/*
verify_email_html = (token_url) -> """
<p style="margin-top:0;margin-bottom:10px;">
<strong>
Please <a href="#{token_url}">click here</a> to verify your email address!  If this link does not work, please copy/paste this URL into a new browser tab and open the link:
</strong>
</p>

<pre style="margin-top:10px;margin-bottom:10px;font-size:11px;">
*{token_url}
</pre>
"""
*/

// Disable verify email message for now, since verify isn't working (?).
const verify_email_html = _ => "";

// beware, this needs to be HTML which is compatible with email-clients!
const welcome_email_html = token_url => `\
<h1>Welcome to ${SITE_NAME}</h1>

<p style="margin-top:0;margin-bottom:10px;">
<a href="${DOMAIN_NAME}">${SITE_NAME}</a> helps you do collaborative
calculations in your web browser.
</p>

<p style="margin-top:0;margin-bottom:20px;">
You received this email because an account with your email address was created.
This was either initiated by you, a friend or colleague invited you, or you're
a student as part of a course.
</p>

${verify_email_html(token_url)}

<hr size="1"/>

<h3>Exploring ${SITE_NAME}</h3>
<p style="margin-top:0;margin-bottom:10px;">
In ${SITE_NAME} your work happens inside <strong>private projects</strong>.
These are personal workspaces which contain your files, computational worksheets, and data.
You can run your computations through the web interface, via interactive worksheets and notebooks, or by executing a program in a terminal.
${SITE_NAME} supports online editing of
    <a href="https://jupyter.org/">Jupyter Notebooks</a>,
    <a href="https://www.sagemath.org/">Sage Worksheets</a>,
    <a href="https://en.wikibooks.org/wiki/LaTeX">Latex files</a>, etc.
</p>

<p><strong>Software:</strong>
<ul>
<li style="margin-top:0;margin-bottom:10px;">Mathematical calculation:
    <a href="https://www.sagemath.org/">SageMath</a>,
    <a href="https://www.sympy.org/">SymPy</a>, etc.
</li>
<li style="margin-top:0;margin-bottom:10px;">Statistics and Data Science:
    <a href="https://www.r-project.org/">R project</a>,
    <a href="http://pandas.pydata.org/">Pandas</a>,
    <a href="http://www.statsmodels.org/">statsmodels</a>,
    <a href="http://scikit-learn.org/">scikit-learn</a>,
    <a href="http://www.nltk.org/">NLTK</a>, etc.
</li>
<li style="margin-top:0;margin-bottom:10px;">Various other computation:
    <a href="https://www.tensorflow.org/">Tensorflow</a>,
    <a href="https://www.gnu.org/software/octave/">Octave</a>,
    <a href="https://julialang.org/">Julia</a>, etc.
</li>
</ul>

<p style="margin-top:0;margin-bottom:20px;">
Visit our <a href="https://cocalc.com/static/doc/software.html">Software overview page</a> for more details!
</p>

<p style="margin-top:0;margin-bottom:20px;">
<strong>Collaboration:</strong>
You can invite collaborators to work with you inside a project.
Like you, they can edit the files in that project.
Edits are visible in <strong>real time</strong> for everyone online.
You can share your thoughts in a <strong>side chat</strong> next to each document.
</p>

<p style="margin-top:0;margin-bottom:10px;"><strong>More information:</strong> how to get from 0 to 100%!</p>

<ul>
<li style="margin-top:0;margin-bottom:10px;">
    <strong><a href="https://doc.cocalc.com/">${SITE_NAME} Manual:</a></strong> learn more about ${SITE_NAME}'s features.
</li>
<li style="margin-top:0;margin-bottom:10px;">
    <a href="https://github.com/sagemathinc/cocalc/wiki">${SITE_NAME} Wiki:</a> the entry-point to learn more about all the details.
</li>
<li style="margin-top:0;margin-bottom:10px;">
    <a href="https://github.com/sagemathinc/cocalc/wiki/sagews">Working with SageMath Worksheets</a>
</li>
<li style="margin-top:0;margin-bottom:10px;">
    <strong><a href="https://cocalc.com/policies/pricing.html">Subscriptions:</a></strong> make hosting more robust and increase project quotas
</li>
<li style="margin-top:0;margin-bottom:10px;">
    <a href="https://doc.cocalc.com/teaching-instructors.html">Sophisticated tools for teaching a class</a>.
</li>
<li style="margin-top:0;margin-bottom:10px;">
    <a href="https://doc.cocalc.com/howto/connectivity-issues.html">Troubleshooting connectivity issues</a>
</li>
<li style="margin-top:0;margin-bottom:10px;">
    <a href="https://github.com/sagemathinc/cocalc/wiki/MathematicalSyntaxErrors">Common mathematical syntax errors:</a> look into this if you are new to working with a programming language!
</li>
</ul>

<p style="margin-top:20px;margin-bottom:10px;">
<strong>Questions?</strong>
</p>
<p style="margin-top:0;margin-bottom:10px;">
Schedule a Live Demo with a specialist from CoCalc: <a href="${LIVE_DEMO_REQUEST}">request form</a>.
</p>
<p style="margin-top:0;margin-bottom:20px;">
In case of problems, concerns why you received this email, or other questions please contact:
<a href="mailto:${HELP_EMAIL}">${HELP_EMAIL}</a>.
</p>
\
`;

exports.welcome_email = function(opts): void {
  let body, category, subject;
  opts = defaults(opts, {
    to: required,
    token: required, // the email verification token
    only_verify: false, // TODO only send the verification token, for now this is good enough
    cb: undefined
  });

  const base_url = require("./base-url").base_url();
  const token_query = encodeURI(
    `email=${encodeURIComponent(opts.to)}&token=${opts.token}`
  );
  const endpoint = os_path.join("/", base_url, "auth/verify");
  const token_url = `${DOMAIN_NAME}${endpoint}?${token_query}`;

  if (opts.only_verify) {
    subject = `Verify your email address on ${SITE_NAME} (${DNS})`;
    body = verify_email_html(token_url);
    category = "verify";
  } else {
    subject = `Welcome to ${SITE_NAME} - ${DNS}`;
    body = welcome_email_html(token_url);
    category = "welcome";
  }

  // exports... because otherwise stubbing in the test suite of send_email would not work
  exports.send_email({
    subject,
    body,
    fromname: COMPANY_NAME,
    from: COMPANY_EMAIL,
    to: opts.to,
    cb: opts.cb,
    category,
    asm_group: 147985
  }); // https://app.sendgrid.com/suppressions/advanced_suppression_manager
};
