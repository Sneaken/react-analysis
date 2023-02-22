import { Component } from "react";

class ClassComponent extends Component {
  state = {
    count: 0,
  };

  constructor(props) {
    super(props);
  }

  componentDidMount() {
    setTimeout(() => {
      this.setState({
        count: 1,
      });
      console.log(this.state.count);
      this.setState({
        count: 2,
      });
      console.log(this.state.count);
      this.setState({
        count: 3,
      });
      console.log(this.state.count);
    });
  }
  render() {
    console.log("render:", this.state.count);
    return <div>{this.state.count}</div>;
  }
}
export default ClassComponent;
