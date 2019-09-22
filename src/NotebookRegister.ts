import {KernelConnector} from "./kernelconnector";

import {VariableInspectionHandler} from "./handler";

import {IVariableManager} from "./manager/tokens";

import {Languages} from "./inspectorscripts";

import {ILabShell, JupyterFrontEnd, JupyterFrontEndPlugin} from '@jupyterlab/application'

import {INotebookTracker, NotebookPanel} from '@jupyterlab/notebook';
import {CommandIDs} from "./VariableManagerRegister";


/**
 * An extension that registers notebooks for variable inspection.
 */
export const notebooks: JupyterFrontEndPlugin<void> = {
    id: "jupyterlab-extension:variableManager:notebooks",
    requires: [IVariableManager, INotebookTracker, ILabShell],
    autoStart: true,
    activate: (app: JupyterFrontEnd, manager: IVariableManager, notebooks: INotebookTracker, labShell: ILabShell): void => {
        const handlers: { [id: string]: Promise<VariableInspectionHandler> } = {};

        /**
         * Subscribes to the creation of new notebooks. If a new notebook is created, build a new handler for the notebook.
         * Adds a promise for a instanced handler to the 'handlers' collection.
         */
        notebooks.widgetAdded.connect((sender, nbPanel: NotebookPanel) => {

            //A promise that resolves after the initialization of the handler is done.
            handlers[nbPanel.id] = new Promise(function (resolve, reject) {

                const session = nbPanel.session;
                const connector = new KernelConnector({session});

                connector.ready.then(() => { // Create connector and init w script if it exists for kernel type.
                    let kerneltype: string = connector.kernelType;
                    let scripts: Promise<Languages.LanguageModel> = Languages.getScript(kerneltype);

                    scripts.then((result: Languages.LanguageModel) => {
                        let initScript = result.initScript;
                        let queryCommand = result.queryCommand;
                        let matrixQueryCommand = result.matrixQueryCommand;
                        let deleteCommand = result.deleteCommand;

                        const options: VariableInspectionHandler.IOptions = {
                            queryCommand: queryCommand,
                            matrixQueryCommand: matrixQueryCommand,
                            deleteCommand: deleteCommand,
                            connector: connector,
                            initScript: initScript,
                            id: session.path  //Using the sessions path as an identifier for now.
                        };
                        const handler = new VariableInspectionHandler(options);
                        manager.addHandler(handler);
                        nbPanel.disposed.connect(() => {
                            delete handlers[nbPanel.id];
                            handler.dispose();
                        });

                        handler.ready.then(() => {
                            resolve(handler);
                        });
                    });


                    //Otherwise log error message.
                    scripts.catch((result: string) => {
                        reject(result);
                    })
                });
            });
        });

        /**
         * If focus window changes, checks whether new focus widget is a notebook.
         * In that case, retrieves the handler associated to the notebook after it has been
         * initialized and updates the manager with it.
         */
        labShell.currentChanged.connect((sender, args) => {
            let widget = args.newValue;
            if (!widget || !notebooks.has(widget)) {
                return;
            }
            let future = handlers[widget.id];
            future.then((source: VariableInspectionHandler) => {
                if (source) {
                    manager.source = source;
                    manager.source.performInspection();
                }
            });
        });

        app.contextMenu.addItem({
            command: CommandIDs.open,
            selector: ".jp-Notebook"
        });
    }
};
