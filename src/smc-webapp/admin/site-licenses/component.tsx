/*
Viewing and configuring site licenses
*/

import {
  React,
  Rendered,
  Component,
  rtypes,
  rclass,
  TypedMap
} from "../../app-framework";
import { ErrorDisplay, Icon, Loading, Space } from "../../r_misc";
import { SiteLicense } from "./types";
import { actions } from "./actions";
import { List } from "immutable";
import { Button } from "antd";

interface Props {
  view?: boolean; // if true, open for viewing/editing
  error?: string;
  loading?: boolean;
  site_licenses?: List<TypedMap<SiteLicense>>;
}

class SiteLicenses extends Component<Props> {
  static reduxProps() {
    return {
      "admin-site-licenses": {
        view: rtypes.bool,
        error: rtypes.string,
        site_licenses: rtypes.immutable.List
      }
    };
  }

  private render_error(): Rendered {
    if (!this.props.error) return;
    return (
      <ErrorDisplay
        error={this.props.error}
        onClose={() => actions.set_error("")}
      />
    );
  }

  private render_loading(): Rendered {
    if (this.props.loading) {
      return <Loading />;
    }
  }

  private render_license(license: TypedMap<SiteLicense>): Rendered {
    return (
      <pre key={license.get("id")}>
        {" "}
        {JSON.stringify(license.toJS(), undefined, 2)}
      </pre>
    );
  }

  private render_main(): void | Rendered[] {
    if (!this.props.view) return;
    if (!this.props.site_licenses) return;
    const v: Rendered[] = [];
    for (const license of this.props.site_licenses) {
      v.push(this.render_license(license));
    }
    return v;
  }

  private render_work_in_progress(): Rendered {
    if (!this.props.view) return;
    return <div>WARNING: this is a work in progress.</div>;
  }

  private render_header_toggle(): Rendered {
    return (
      <h4
        onClick={() => actions.set_view(!this.props.view)}
        style={{ cursor: "pointer" }}
      >
        <Icon
          style={{ width: "20px" }}
          name={this.props.view ? "caret-down" : "caret-right"}
        />{" "}
        Site Licenses
      </h4>
    );
  }

  private render_reload_button(): Rendered {
    if (!this.props.view) return;
    return (
      <Button
        onClick={() => actions.load()}
        disabled={this.props.loading}
        style={{ margin: "15px 0" }}
      >
        <Icon name="sync" spin={this.props.loading} />
        <Space /> Reload
      </Button>
    );
  }

  render(): Rendered {
    return (
      <div>
        {this.render_header_toggle()}
        {this.render_reload_button()}
        {this.render_error()}
        {this.render_loading()}
        {this.render_work_in_progress()}
        {this.render_main()}
      </div>
    );
  }
}

const c = rclass(SiteLicenses);
export { c as SiteLicenses };
