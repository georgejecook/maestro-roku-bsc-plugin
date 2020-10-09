import { BindingType, BindingSendMode } from './BindingType';

export class BindingProperties {

  constructor(public type: BindingType = BindingType.invalid,
    public fireOnSet: boolean = false,
    public transformFunction: string = null,
    public isFiringOnce: boolean = false,
    public sendMode: BindingSendMode = BindingSendMode.na,
  ) {
  }

  getModeText(): string {
    switch (this.sendMode) {
      case BindingSendMode.value:
        return "value";
      case BindingSendMode.node:
        return "node"
      case BindingSendMode.both:
        return "both"
      case BindingSendMode.field:
        return "field"
      case BindingSendMode.na:
      case BindingSendMode.none:
      default:
        return "none";
    }
  }

}
