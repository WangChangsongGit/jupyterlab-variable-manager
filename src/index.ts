import {JupyterFrontEndPlugin} from '@jupyterlab/application'
import {variableManager} from "./VariableManagerRegister";
import {notebooks} from "./NotebookRegister";


/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [variableManager, notebooks];
export default plugins;
