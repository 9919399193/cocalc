/* Toggle diff mode
 */

import { Rendered, Component, React } from "../../app-framework";
//import Form from "new-react-bootstrap/Form";
import 'new-bootstrap/dist/css/bootstrap.min.css';
const Form = require("new-react-bootstrap/Form");
import { TimeTravelActions } from "./actions";

interface Props {
  id: string;
  actions: TimeTravelActions;
  disabled: boolean;
  changes_mode: boolean; // whether or not in changes mode.
}

export class ChangesMode extends Component<Props> {
  private toggle(): void {
    this.props.actions.set_changes_mode(
      this.props.id,
      !this.props.changes_mode
    );
  }

  public render(): Rendered {
    return (
      <Form.Check
        type="checkbox"
        disabled={this.props.disabled}
        title={
          "Toggle whether or not to show the changes from one point in time to another"
        }
        onChange={this.toggle.bind(this)}
        checked={this.props.disabled ? false : this.props.changes_mode}
        style={{ display: "inline", margin: "0 10px" }}
      >
        Changes
      </Form.Check>
    );
  }
}
