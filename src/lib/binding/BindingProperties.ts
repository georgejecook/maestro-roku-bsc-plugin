import { BindingType, BindingSendMode } from './BindingType';

export class BindingProperties {

    constructor(public type: BindingType = BindingType.invalid,
        public fireTiming: string = 'none', // can be lazy or eager
        public transformFunction: string = null,
        public isFiringOnce: boolean = false,
        public sendMode: BindingSendMode = BindingSendMode.na
    ) {
    }

    getModeText(): string {
        switch (this.sendMode) {
            case BindingSendMode.value:
                return 'value';
            case BindingSendMode.node:
                return 'node';
            case BindingSendMode.both:
                return 'both';
            case BindingSendMode.field:
                return 'field';
            case BindingSendMode.na:
            case BindingSendMode.none:
            default:
                return 'none';
        }
    }

    get fireOnSetText() {
        if (this.fireTiming === 'lazy') {
            return false;
        } else if (this.fireTiming === 'eager') {
            return true;
        } else {
            switch (this.type) {
                case BindingType.oneWaySource:
                case BindingType.code:
                case BindingType.static:
                    return true;
                case BindingType.oneWayTarget:
                case BindingType.twoWay:
                    return false;
                case BindingType.invalid:
                default:
                    return false;
            }
        }
    }

}
