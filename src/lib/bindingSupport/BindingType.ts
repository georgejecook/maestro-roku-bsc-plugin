export enum BindingType {
  invalid,
  oneWaySource, //one way from observable to view target - also denoted with {{}}
  oneWayTarget, //one way from view target to observable - also denoted with {()}
  twoWay, //both direction - also denoted with {[]},
  static, //efficient one off binding - also denoted with {{:}}
  code, //efficient one off binding, with actual code {{=}}
}

export enum CallArgs {
  na = 0,
  none = 1,
  value = 2, //send the data
  node = 3, //send the node
  both = 4, //send data,node
}
