import {VariableInspectorPanel} from "./widget/VariableViewWidget";

import {VariableManager} from "./manager/manager";
import {IVariableManager} from "./manager/tokens";

import {ICommandPalette, WidgetTracker} from '@jupyterlab/apputils';

import {ILabShell, ILayoutRestorer, JupyterFrontEnd, JupyterFrontEndPlugin} from '@jupyterlab/application'


export namespace CommandIDs {
    export const open = "variableManager:open";
}

/**
 * A service providing variable introspection.
 */
export const variableManager: JupyterFrontEndPlugin<IVariableManager> = {
    id: "jupyterlab-extension:variableManager",
    requires: [ICommandPalette, ILayoutRestorer, ILabShell],
    provides: IVariableManager,
    autoStart: true,
    activate: (app: JupyterFrontEnd, palette: ICommandPalette, restorer: ILayoutRestorer, labShell: ILabShell): IVariableManager => {


        const manager = new VariableManager();
        const category = "Variable Inspector";
        const command = CommandIDs.open;
        const label = "Open Variable Inspector";
        const namespace = "variableManager";
        const tracker = new WidgetTracker<VariableInspectorPanel>({namespace});


        /**
         * Create and track a new inspector.
         */
        function newPanel(): VariableInspectorPanel {
            const panel = new VariableInspectorPanel();

            panel.id = "jp-variableManager";
            panel.title.label = "Variable Inspector";
            panel.title.closable = true;
            panel.disposed.connect(() => {
                if (manager.panel === panel) {
                    manager.panel = null;
                }
            });

            //Track the inspector panel
            tracker.add(panel);

            return panel;
        }

        // Enable state restoration
        restorer.restore(tracker, {
            command,
            args: () => null,
            name: () => "variableManager"
        });

        // Add command to palette
        app.commands.addCommand(command, {
            label,
            execute: () => {
                if (!manager.panel || manager.panel.isDisposed) {
                    manager.panel = newPanel();
                }
                if (!manager.panel.isAttached) {
                    labShell.add(manager.panel, 'main');
                }
                if (manager.source) {
                    manager.source.performInspection();
                }
                labShell.activateById(manager.panel.id);
            }
        });
        palette.addItem({command, category});
        return manager;
    }
};
