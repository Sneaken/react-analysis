import { Component } from "react";

class ClassComponent extends Component {
  state = {
    count: 0,
  };

  constructor(props) {
    super(props);
  }

  handleClick = async () => {
    this.setState({ count: this.state.count + 1 });
    this.setState({ count: this.state.count + 2 });
    this.setState({ count: this.state.count + 3 });

    // await Promise.resolve();
    // this.setState({ count: this.state.count + 1 });
    // this.setState({ count: this.state.count + 2 });
    // this.setState({ count: this.state.count + 3 });

    // setTimeout(() => {
    //   this.setState({ count: this.state.count + 1 });
    //   this.setState({ count: this.state.count + 2 });
    //   this.setState({ count: this.state.count + 3 });
    // }, 1000);
  };
  render() {
    console.count("render");
    return <div onClick={this.handleClick}>{this.state.count}</div>;
  }
}
export default ClassComponent;
