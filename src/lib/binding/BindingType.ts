export enum BindingType {
    invalid = 0,
    oneWaySource = 1, //one way from observable to view target - also denoted with {{}}
    oneWayTarget = 2, //one way from view target to observable - also denoted with {()}
    twoWay = 3, //both direction - also denoted with {[]},
    static = 4, //efficient one off binding - also denoted with {{:}}
    code = 5 //efficient one off binding, with actual code {{=}}
}


export enum BindingSendMode {
    na = 0,
    field = 1,
    none = 2,
    value = 3,
    node = 4,
    both = 5, //send data,node
    badlyFormed = 6
}
