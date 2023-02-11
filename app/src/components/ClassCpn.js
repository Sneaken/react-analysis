import { Component } from "react";

class ClassCpn extends Component {
  render() {
    const { count, onClick } = this.props;
    return (
      <button ref="ref" onClick={onClick}>
        {count}
      </button>
    );
  }
}

export default ClassCpn;
