import {Token} from '@phosphor/coreutils';
import {VariableInspectionHandler} from "../handler";
import {IVariableInspector} from "./manager"

export interface IVariableManager {
    source: IVariableInspector.IInspectable | null;

    hasHandler(id: string): boolean;

    getHandler(id: string): VariableInspectionHandler;

    addHandler(handler: VariableInspectionHandler): void;

}

export const IVariableManager = new Token<IVariableManager>(
    "jupyterlab_extension/variableManager:IVariableManager"
);
