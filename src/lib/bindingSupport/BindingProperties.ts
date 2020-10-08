import { BindingType, CallArgs } from './BindingType';

export class BindingProperties {

  constructor(public type: BindingType = BindingType.invalid,
    public fireOnSet: boolean = true,
    public transformFunction: string = null,
    public isFiringOnce: boolean = false,
    public callArgs: CallArgs = CallArgs.na,
  ) {
  }

  public getBrsText() {
    // tslint:disable-next-line:max-line-length
    return `[${this.fireOnSet ? 'true' : 'false'}, ${this.transformFunction ? `${this.transformFunction}` : 'invalid'}, ${this.isFiringOnce ? 'true' : 'false'}, ${this.callArgs.valueOf()}]`;
  }
}
