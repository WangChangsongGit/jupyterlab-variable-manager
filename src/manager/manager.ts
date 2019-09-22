import {IVariableManager} from "./tokens"
import {VariableInspectorPanel} from "../widget/VariableViewWidget"
import {VariableInspectionHandler} from "../handler";
import {DataModel} from "@phosphor/datagrid";
import {ISignal} from '@phosphor/signaling';

/**
 * A namespace for inspector interfaces.
 */
export namespace IVariableInspector {

    export interface IInspectable {
        disposed: ISignal<any, void>;
        inspected: ISignal<any, IVariableInspectorUpdate>;

        performInspection(): void;

        performMatrixInspection(varName: string, maxRows?: number): Promise<DataModel>;

        performDelete(varName: string): void;
    }

    export interface IVariableInspectorUpdate {
        title: IVariableTitle;
        payload: Array<IVariable>;
    }

    export interface IVariable {
        varName: string;
        varSize: string;
        varShape: string;
        varContent: string;
        varType: string;
        isMatrix: boolean;
    }

    export interface IVariableTitle {
        kernelName?: string;
        languageName?: string;
        contextName?: string; //Context currently reserved for special information.
    }
}

/**
 * A class that manages variable inspector widget instances and offers persistent
 * `IVariableInspector` instance that other plugins can communicate with.
 */
export class VariableManager implements IVariableManager {

    private _handlers: { [id: string]: VariableInspectionHandler } = {};

    private _source: IVariableInspector.IInspectable = null;

    /**
     * The source of events the inspector panel listens for.
     */
    get source(): IVariableInspector.IInspectable {
        return this._source;
    }

    set source(source: IVariableInspector.IInspectable) {

        if (this._source === source) {
            return;
        }

        // remove subscriptions
        if (this._source) {
            this._source.disposed.disconnect(this._onSourceDisposed, this);
        }

        this._source = source;

        if (this._panel && !this._panel.isDisposed) {
            this._panel.source = this._source;
        }
        // Subscribe to new source
        if (this._source) {
            this._source.disposed.connect(this._onSourceDisposed, this);
        }
    }

    private _panel: VariableInspectorPanel = null;

    /**
     * The current inspector panel.
     */
    get panel(): VariableInspectorPanel {
        return this._panel;
    }

    set panel(panel: VariableInspectorPanel) {

        if (this.panel === panel) {
            return;
        }
        this._panel = panel;

        if (panel && !panel.source) {
            panel.source = this._source;
        }
    }

    public hasHandler(id: string): boolean {
        if (this._handlers[id]) {
            return true;
        } else {
            return false;
        }
    }

    public getHandler(id: string): VariableInspectionHandler {
        return this._handlers[id];
    }

    public addHandler(handler: VariableInspectionHandler) {
        this._handlers[handler.id] = handler;
    }

    private _onSourceDisposed() {
        this._source = null;
    }

}
