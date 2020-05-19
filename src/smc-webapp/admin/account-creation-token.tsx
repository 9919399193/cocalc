/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

/*
Input box for setting the account creation token.
*/

import { List } from "immutable";
import { React, Rendered, Component, redux, TypedMap } from "../app-framework";
import { Button, Well, FormGroup, FormControl } from "react-bootstrap";
import { query } from "../frame-editors/generic/client";
import { ErrorDisplay, Saving, COLORS } from "../r_misc";
import { PassportStrategy } from "../account/passport-types";

interface State {
  state: "view" | "edit" | "save";
  token: string;
  error: string;
}

export class AccountCreationToken extends Component<{}, State> {
  constructor(props) {
    super(props);
    this.state = {
      state: "view", // view --> edit --> save --> view
      token: "",
      error: "",
    };
  }

  edit(): void {
    this.setState({ state: "edit" });
  }

  async save(): Promise<void> {
    this.setState({ state: "save" });
    try {
      await query({
        query: {
          server_settings: {
            name: "account_creation_token",
            value: this.state.token,
          },
        },
      });
      this.setState({ state: "view", error: "", token: "" });
    } catch (err) {
      this.setState({ state: "edit", error: err });
    }
  }

  render_save_button(): Rendered {
    return (
      <Button
        style={{ marginRight: "1ex" }}
        onClick={() => this.save()}
        bsStyle="success"
      >
        Save Token
      </Button>
    );
  }

  render_control(): Rendered {
    switch (this.state.state) {
      case "view":
        return (
          <Button onClick={() => this.edit()} bsStyle="warning">
            Change Token...
          </Button>
        );
      case "edit":
      case "save":
        return (
          <Well>
            <form onSubmit={this.save}>
              <FormGroup>
                <FormControl
                  ref="input"
                  type="text"
                  value={this.state.token}
                  onChange={(e) =>
                    this.setState({ token: (e.target as any).value })
                  }
                />
              </FormGroup>
            </form>
            {this.render_save_button()}
            <Button onClick={() => this.setState({ state: "view", token: "" })}>
              Cancel
            </Button>
            <br />
            <br />
            (Set to empty to not require a token.)
          </Well>
        );
    }
  }

  private render_error(): Rendered {
    if (this.state.error) {
      return (
        <ErrorDisplay
          error={this.state.error}
          onClose={() => this.setState({ error: "" })}
        />
      );
    }
  }

  private render_save(): Rendered {
    if (this.state.state === "save") {
      return <Saving />;
    }
  }

  private render_unsupported(): Rendered {
    // see https://github.com/sagemathinc/cocalc/issues/333
    return (
      <div style={{ color: COLORS.GRAY }}>
        Not supported since at last one "public" passport strategy is enabled.
      </div>
    );
  }

  private render_info(): Rendered {
    return (
      <div style={{ color: COLORS.GRAY, fontStyle: "italic" }}>
        Note: You can disable email sign up in Site Settings
      </div>
    );
  }

  // disable token editing if any strategy besides email is public
  private not_supported(strategies): boolean {
    return strategies
      .filterNot((s) => s.get("name") === "email")
      .some((s) => s.get("public"));
  }

  private render_content(): Rendered {
    const account_store: any = redux.getStore("account");
    if (account_store == null) {
      return <div>Account store not defined -- refresh your browser.</div>;
    }
    const strategies:
      | List<TypedMap<PassportStrategy>>
      | undefined = account_store.get("strategies");
    if (strategies == null) {
      // I hit this in production once and it crashed my browser.
      return <div>strategies not loaded -- refresh your browser.</div>;
    }
    if (this.not_supported(strategies)) {
      return this.render_unsupported();
    } else {
      return (
        <div>
          {this.render_control()}
          {this.render_save()}
          {this.render_error()}
          {this.render_info()}
        </div>
      );
    }
  }

  render(): Rendered {
    return (
      <div>
        <h4>Account Creation Token</h4>
        {this.render_content()}
      </div>
    );
  }
}
