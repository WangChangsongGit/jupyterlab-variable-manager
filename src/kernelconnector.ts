import {IClientSession} from "@jupyterlab/apputils";

import {Kernel, KernelMessage} from "@jupyterlab/services";

import {ISignal, Signal} from "@phosphor/signaling";


/**
 * Connector class that handles execute request to a kernel
 */
export class KernelConnector {

    private _session: IClientSession;

    constructor(options: KernelConnector.IOptions) {
        this._session = options.session;
        this._session.statusChanged.connect((sender, new_status: Kernel.Status) => {
            switch (new_status) {
                case "restarting":
                    //TODO : Check for kernel availability
                    this._kernelRestarted.emit(this._session.kernel.ready);
                default:
                    break;
            }
        });
    }

    private _kernelRestarted = new Signal<this, Promise<void>>(this);

    get kernelRestarted(): ISignal<KernelConnector, Promise<void>> {
        return this._kernelRestarted
    }

    get kernelType(): string {
        return this._session.kernel.info.language_info.name;
    }

    get kernelName(): string {
        return this._session.kernel.name;
    }


    /**
     *  A Promise that is fulfilled when the session associated w/ the connector is ready.
     */
    get ready(): Promise<void> {
        return this._session.ready.then(() => {
            return this._session.kernel.ready
        });
    }

    /**
     *  A signal emitted for iopub messages of the kernel associated with the kernel.
     */
    get iopubMessage(): ISignal<IClientSession, KernelMessage.IMessage> {
        return this._session.iopubMessage;
    }


    /**
     * Executes the given request on the kernel associated with the connector.
     * @param content: IExecuteRequestMsg to forward to the kernel.
     * @param ioCallback: Callable to forward IOPub messages of the kernel to.
     * @returns Promise<KernelMessage.IExecuteReplyMsg>
     */
    fetch(content: KernelMessage.IExecuteRequestMsg['content'], ioCallback: (msg: KernelMessage.IIOPubMessage) => any): Promise<KernelMessage.IExecuteReplyMsg> {
        const kernel = this._session.kernel;
        if (!kernel) {
            return Promise.reject(new Error("Require kernel to perform variable inspection!"));
        }

        return kernel.ready.then(() => {
            let future = kernel.requestExecute(content, false);

            future.onIOPub = ((msg: KernelMessage.IIOPubMessage) => {
                ioCallback(msg);
            });
            return future.done as Promise<KernelMessage.IExecuteReplyMsg>;
        });
    }

}

export namespace KernelConnector {
    export interface IOptions {
        session: IClientSession;

    }
}
