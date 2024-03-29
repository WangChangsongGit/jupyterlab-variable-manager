import {IDisposable} from '@phosphor/disposable';

import {IVariableInspector} from './manager/manager';

import {KernelConnector} from "./kernelconnector";

import {IClientSession} from "@jupyterlab/apputils";

import {KernelMessage} from "@jupyterlab/services";

import {ISignal, Signal} from "@phosphor/signaling"

import {nbformat} from "@jupyterlab/coreutils"

import {DataModel, JSONModel} from "@phosphor/datagrid";

/**
 * An object that handles code inspection.
 */
export class VariableInspectionHandler implements IDisposable, IVariableInspector.IInspectable {

    private _connector: KernelConnector;
    private _queryCommand: string;
    private _initScript: string;
    private _matrixQueryCommand: string;
    private _deleteCommand: string;

    constructor(options: VariableInspectionHandler.IOptions) {
        this._connector = options.connector;
        this._id = options.id;
        this._queryCommand = options.queryCommand;
        this._matrixQueryCommand = options.matrixQueryCommand;
        this._deleteCommand = options.deleteCommand;
        this._initScript = options.initScript;

        this._ready = this._connector.ready.then(() => {
            this._initOnKernel().then((msg: KernelMessage.IExecuteReplyMsg) => {
                this._connector.iopubMessage.connect(this._queryCall);
                return;

            });
        });

        this._connector.kernelRestarted.connect((sender, kernelReady: Promise<void>) => {

            const title: IVariableInspector.IVariableTitle = {
                contextName: "<b>Restarting kernel...</b> "
            };
            this._inspected.emit(<IVariableInspector.IVariableInspectorUpdate>{title: title, payload: []});

            this._ready = kernelReady.then(() => {
                this._initOnKernel().then((msg: KernelMessage.IExecuteReplyMsg) => {
                    this._connector.iopubMessage.connect(this._queryCall);
                    this.performInspection();
                });
            });
        });

    }

    private _disposed = new Signal<this, void>(this);

    /**
     * A signal emitted when the handler is disposed.
     */
    get disposed(): ISignal<VariableInspectionHandler, void> {
        return this._disposed;
    }

    private _inspected = new Signal<this, IVariableInspector.IVariableInspectorUpdate>(this);

    /**
     * A signal emitted when an inspector value is generated.
     */
    get inspected(): ISignal<VariableInspectionHandler, IVariableInspector.IVariableInspectorUpdate> {
        return this._inspected;
    }

    private _isDisposed = false;

    get isDisposed(): boolean {
        return this._isDisposed;
    }

    private _ready: Promise<void>;

    get ready(): Promise<void> {
        return this._ready;
    }

    private _id: string;

    get id(): string {
        return this._id;
    }

    /**
     * Performs an inspection by sending an execute request with the query command to the kernel.
     */
    public performInspection(): void {
        let content: KernelMessage.IExecuteRequestMsg['content'] = {
            code: this._queryCommand,
            stop_on_error: false,
            store_history: false
        };
        this._connector.fetch(content, this._handleQueryResponse);
    }

    /**
     * Performs an inspection of the specified matrix.
     */
    public performMatrixInspection(varName: string, maxRows = 100000): Promise<DataModel> {
        let request: KernelMessage.IExecuteRequestMsg['content'] = {
            code: this._matrixQueryCommand + "(" + varName + ", " + maxRows + ")",
            stop_on_error: false,
            store_history: false
        };
        let con = this._connector;
        return new Promise(function (resolve, reject) {
            con.fetch(request,
                (response: KernelMessage.IIOPubMessage) => {
                    let msgType = response.header.msg_type;
                    switch (msgType) {
                        case "execute_result":
                            let payload = response.content as nbformat.IExecuteResult;
                            let content: string = <string>payload.data["text/plain"];
                            let content_clean = content.replace(/^'|'$/g, "");
                            content_clean = content_clean.replace(/\\"/g, '"');
                            content_clean = content_clean.replace(/\\'/g, "\\\\'");

                            let modelOptions = <JSONModel.IOptions>JSON.parse(content_clean);
                            let jsonModel = new JSONModel(modelOptions);
                            resolve(jsonModel);
                            break;
                        case "error":
                            console.log(response);
                            reject("Kernel error on 'matrixQuery' call!");
                            break;
                        default:
                            break;
                    }
                }
            );
        });
    }

    /**
     * Send a kernel request to delete a variable from the global environment
     */
    public performDelete(varName: string): void {
        let content: KernelMessage.IExecuteRequestMsg['content'] = {
            code: this._deleteCommand + "('" + varName + "')",
            stop_on_error: false,
            store_history: false,
        };

        this._connector.fetch(content, this._handleQueryResponse);
    }


    /*
     * Disposes the kernel connector.
     */
    dispose(): void {
        if (this.isDisposed) {
            return;
        }
        this._isDisposed = true;
        this._disposed.emit(void 0);
        Signal.clearData(this);
    }


    /**
     * Initializes the kernel by running the set up script located at _initScriptPath.
     */
    private _initOnKernel(): Promise<KernelMessage.IExecuteReplyMsg> {
        let content: KernelMessage.IExecuteRequestMsg['content'] = {
            code: this._initScript,
            stop_on_error: false,
            silent: true,
        };

        return this._connector.fetch(content, (() => {
        }));
    }

    /*
     * Handle query response. Emit new signal containing the IVariableInspector.IInspectorUpdate object.
     * (TODO: query resp. could be forwarded to panel directly)
     */
    private _handleQueryResponse = (response: KernelMessage.IIOPubMessage): void => {
        let msgType = response.header.msg_type;
        switch (msgType) {
            case "execute_result":
                let payload = response.content as nbformat.IExecuteResult;
                let content: string = <string>payload.data["text/plain"];
                if (content.slice(0, 1) == "'" || content.slice(0, 1) == "\"") {
                    content = content.slice(1, -1);
                    content = content.replace(/\\"/g, "\"").replace(/\\'/g, "\'");
                }

                let update: IVariableInspector.IVariable[];
                update = <IVariableInspector.IVariable[]>JSON.parse(content);

                let title: IVariableInspector.IVariableTitle;
                title = {
                    contextName: "",
                    kernelName: this._connector.kernelName || "",
                    languageName: this._connector.kernelType || ""
                };

                this._inspected.emit({title: title, payload: update});
                break;
            case "display_data":
                let payload_display = response.content as nbformat.IExecuteResult;
                let content_display: string = <string>payload_display.data["text/plain"];
                if (content_display.slice(0, 1) == "'" || content_display.slice(0, 1) == "\"") {
                    content_display = content_display.slice(1, -1);
                    content_display = content_display.replace(/\\"/g, "\"").replace(/\\'/g, "\'");
                }

                let update_display: IVariableInspector.IVariable[];
                update_display = <IVariableInspector.IVariable[]>JSON.parse(content_display);

                let title_display: IVariableInspector.IVariableTitle;
                title_display = {
                    contextName: "",
                    kernelName: this._connector.kernelName || "",
                    languageName: this._connector.kernelType || ""
                };

                this._inspected.emit({title: title_display, payload: update_display});
                break;
            default:
                break;
        }
    };

    /*
     * Invokes a inspection if the signal emitted from specified session is an 'execute_input' msg.
     */
    private _queryCall = (sess: IClientSession, msg: KernelMessage.IExecuteInputMsg) => {
        let msgType = msg.header.msg_type;
        switch (msgType) {
            case 'execute_input':
                let code = msg.content.code;
                if (!(code == this._queryCommand) && !(code == this._matrixQueryCommand)) {
                    this.performInspection();
                }
                break;
            default:
                break;
        }
    };
}

/**
 * A name space for inspection handler statics.
 */
export namespace VariableInspectionHandler {
    /**
     * The instantiation options for an inspection handler.
     */
    export interface IOptions {
        connector: KernelConnector;
        queryCommand: string;
        matrixQueryCommand: string;
        deleteCommand: string;
        initScript: string;
        id: string;
    }
}
